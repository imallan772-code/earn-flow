/**
 * Promo AI helper — server-only.
 *
 * Provider 우선순위 (handler 내부에서 process.env read):
 *   1) GEMINI_API_KEY     → Google Generative Language API (Flash 무료)
 *   2) LOVABLE_API_KEY    → Lovable AI Gateway (preview)
 *   3) null               → caller가 fallback 처리
 *
 * 절대 module-level에서 process.env 읽지 말 것 (Cloudflare Workers).
 * 절대 VITE_* prefix 사용 금지 (client 노출).
 */
import process from "node:process";
import { z } from "zod";
import type { PromoChannelId, PromoVariant } from "@/features/admin/promo/types";
import { buildFallbackVariants } from "./fallbackVariants";

export type PromoAiProvider = "gemini-direct" | "lovable-gateway";

export type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_PARSE_ERROR"
  | "AI_ERROR";

export type AiEnvelope<T> =
  | { ok: true; data: T; provider: PromoAiProvider }
  | { ok: false; code: AiErrorCode; message?: string };

const DIRECT_DEFAULT_MODEL = "gemini-2.5-flash";
const GATEWAY_DEFAULT_MODEL = "google/gemini-3-flash-preview";
const DIRECT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GATEWAY_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";

const DEFAULT_TIMEOUT_MS = 25_000;

export interface ResolvedProvider {
  provider: PromoAiProvider;
  apiKey: string;
  model: string;
}

/** handler 내부에서만 호출. 키 값은 절대 client로 흘러나가면 안 됨. */
export function resolveProvider(): ResolvedProvider | null {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      provider: "gemini-direct",
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || DIRECT_DEFAULT_MODEL,
    };
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    return {
      provider: "lovable-gateway",
      apiKey: lovableKey,
      model: process.env.LOVABLE_PROMO_MODEL || GATEWAY_DEFAULT_MODEL,
    };
  }
  return null;
}

// ── Bundle schema (단일 1 call 응답) ───────────────────────────
const CHANNEL_ENUM: PromoChannelId[] = [
  "telegram",
  "discord",
  "slack",
  "x",
  "linkedin",
  "tiktok",
  "resend",
  "zapier",
  "copy",
];

const variantSchema = z.object({
  channel: z.string(),
  body: z.string().min(1).max(800),
  hashtags: z.array(z.string()).max(10).optional().default([]),
  cta: z.string().max(40).optional(),
  imagePrompt: z.string().max(300).optional(),
});

const bundleSchema = z.object({
  brief: z.string().optional().default(""),
  variants: z.array(variantSchema).default([]),
  risk: z
    .object({
      score: z.number().min(0).max(100).default(0),
      flags: z.array(z.string()).max(20).default([]),
    })
    .optional()
    .default({ score: 0, flags: [] }),
});

export type PromoAiBundle = z.infer<typeof bundleSchema>;

export interface ParsedBundle {
  brief: string;
  variants: PromoVariant[];
  risk: { score: number; flags: string[] };
}

/**
 * AI 응답 raw text → 정합 검증 + 5채널 누락 patch.
 * raw가 JSON 아닐 때도 throw 대신 best-effort 파싱.
 */
export function parseAiBundle(
  raw: string,
  input: { brief: string; channels: PromoChannelId[] },
): ParsedBundle {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFences(raw));
  } catch {
    throw new AiParseError("Invalid JSON");
  }
  const parsed = bundleSchema.safeParse(json);
  if (!parsed.success) throw new AiParseError(parsed.error.message);

  const ts = Date.now();
  const byChannel = new Map<PromoChannelId, PromoVariant>();
  parsed.data.variants.forEach((v, i) => {
    const ch = normalizeChannel(v.channel);
    if (!ch || !input.channels.includes(ch)) return;
    byChannel.set(ch, {
      id: `ai-${ts}-${i}`,
      channel: ch,
      body: v.body,
      hashtags: (v.hashtags ?? []).filter((h) => h.trim().length > 0),
      cta: v.cta,
      weight: 1,
      imagePrompt: v.imagePrompt,
    });
  });

  // 누락 채널 → fallback patch
  const fb = buildFallbackVariants(input.brief, input.channels);
  const merged = input.channels.map((ch) => byChannel.get(ch) ?? fb.find((v) => v.channel === ch)!);

  return {
    brief: parsed.data.brief || input.brief,
    variants: merged,
    risk: {
      score: parsed.data.risk?.score ?? 0,
      flags: parsed.data.risk?.flags ?? [],
    },
  };
}

function normalizeChannel(raw: string): PromoChannelId | null {
  const lower = raw.toLowerCase().trim();
  return (CHANNEL_ENUM as string[]).includes(lower) ? (lower as PromoChannelId) : null;
}

function stripCodeFences(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  return t;
}

export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiParseError";
  }
}

// ── HTTP 호출 ─────────────────────────────────────────────────
export interface CallPromptInput {
  brief: string;
  title: string;
  targetUrl: string;
  channels: PromoChannelId[];
}

export async function callPromoBundle(
  input: CallPromptInput,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<AiEnvelope<ParsedBundle>> {
  const resolved = resolveProvider();
  if (!resolved) return { ok: false, code: "AI_NOT_CONFIGURED" };

  const prompt = buildPromptText(input);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  try {
    const raw =
      resolved.provider === "gemini-direct"
        ? await callGeminiDirect(resolved, prompt, ac.signal)
        : await callLovableGateway(resolved, prompt, ac.signal);

    if (!raw.ok) return { ok: false, code: raw.code, message: raw.message };
    const bundle = parseAiBundle(raw.text, { brief: input.brief, channels: input.channels });
    return { ok: true, data: bundle, provider: resolved.provider };
  } catch (e) {
    if (e instanceof AiParseError) {
      return { ok: false, code: "AI_PARSE_ERROR", message: e.message };
    }
    if ((e as Error)?.name === "AbortError") {
      return { ok: false, code: "AI_TIMEOUT" };
    }
    return { ok: false, code: "AI_ERROR", message: (e as Error)?.message };
  } finally {
    clearTimeout(timer);
  }
}

function buildPromptText(input: CallPromptInput): string {
  const chList = input.channels.join(", ");
  return [
    "당신은 한국어 SNS 마케팅 카피라이터입니다.",
    "다음 brief를 바탕으로 채널별 프로모 카피를 작성하세요.",
    "반드시 JSON 객체로만 응답합니다 (마크다운 펜스 금지).",
    "",
    `제목: ${input.title || "(미지정)"}`,
    `랜딩 URL: ${input.targetUrl}`,
    `대상 채널: ${chList}`,
    `Brief: ${input.brief}`,
    "",
    "응답 스키마:",
    `{
  "brief": "정제된 한 줄 요약",
  "variants": [
    { "channel": "telegram|x|slack|discord|linkedin|tiktok|resend|zapier|copy",
      "body": "채널 톤에 맞는 한국어 카피 (X는 280자 이내)",
      "hashtags": ["#태그1", "#태그2"],
      "cta": "행동 유도 문구",
      "imagePrompt": "선택, 영문 이미지 생성용 프롬프트 1-2 문장" }
  ],
  "risk": { "score": 0-100, "flags": ["발견된 리스크 키워드"] }
}`,
    "",
    "각 대상 채널마다 정확히 1개 variant를 생성하세요.",
    "도박·원금보장·확정수익 같은 표현은 risk.flags에 기록하고 score를 높이세요.",
  ].join("\n");
}

type RawResult =
  | { ok: true; text: string }
  | { ok: false; code: AiErrorCode; message?: string };

async function callGeminiDirect(
  r: ResolvedProvider,
  prompt: string,
  signal: AbortSignal,
): Promise<RawResult> {
  const url = `${DIRECT_ENDPOINT}/${encodeURIComponent(r.model)}:generateContent?key=${encodeURIComponent(r.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
  });
  if (res.status === 429) return { ok: false, code: "AI_RATE_LIMITED" };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, code: "AI_ERROR", message: `gemini ${res.status}: ${body.slice(0, 200)}` };
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, code: "AI_PARSE_ERROR", message: "empty candidate" };
  return { ok: true, text };
}

async function callLovableGateway(
  r: ResolvedProvider,
  prompt: string,
  signal: AbortSignal,
): Promise<RawResponse | AiEnvelope<never>> {
  const res = await fetch(GATEWAY_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${r.apiKey}`,
    },
    body: JSON.stringify({
      model: r.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) return { ok: false, code: "AI_RATE_LIMITED" };
  if (res.status === 402) return { ok: false, code: "AI_ERROR", message: "credits exhausted" };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, code: "AI_ERROR", message: `gateway ${res.status}: ${body.slice(0, 200)}` };
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { ok: false, code: "AI_PARSE_ERROR", message: "empty choice" };
  return { ok: true, text };
}

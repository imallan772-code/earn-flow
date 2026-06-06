/**
 * Phase Z-1 — Promo server functions.
 *
 * - getPromoAiStatus : provider 상태 (키 노출 0)
 * - composePromoVariants : brief+variants+risk 단일 Gemini call (1 API call)
 * - composePromoBrief / scanPromoRisk : 테스트용 thin export
 * - translatePromo : UI 미노출 stub envelope
 *
 * server in-memory store 금지 (`new Map()` / module-level `let arr=[]` 금지).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { promoListAssets, promoListCampaigns, promoListDispatches } from "@/lib/api/promo";
import {
  callPromoBundle,
  resolveProvider,
  type AiErrorCode,
  type PromoAiProvider,
} from "./ai.server";
import { mergeRiskScores, scanRiskLocal } from "./risk";
import type { PromoChannelId } from "@/features/admin/promo/types";

// ── 1) AI provider status (키 노출 0) ─────────────────────────
export const getPromoAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const r = resolveProvider();
  return {
    configured: r !== null,
    provider: (r?.provider ?? null) as PromoAiProvider | null,
  };
});

// ── 2) Compose variants (단일 1 call) ─────────────────────────
const CHANNEL_SCHEMA = z.enum([
  "telegram",
  "discord",
  "slack",
  "x",
  "linkedin",
  "tiktok",
  "resend",
  "zapier",
  "copy",
]);

const composeInputSchema = z.object({
  brief: z.string().min(1).max(2000),
  title: z.string().max(200).default(""),
  targetUrl: z.string().max(500).default(""),
  channels: z.array(CHANNEL_SCHEMA).min(1).max(9),
});

export const composePromoVariants = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => composeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await callPromoBundle({
      brief: data.brief,
      title: data.title,
      targetUrl: data.targetUrl,
      channels: data.channels as PromoChannelId[],
    });

    if (!result.ok) {
      return { ok: false as const, code: result.code, message: result.message };
    }

    // local risk + AI risk 병합
    const local = scanRiskLocal(`${data.title} ${data.brief}`);
    const merged = mergeRiskScores(local, result.data.risk);

    return {
      ok: true as const,
      provider: result.provider,
      brief: result.data.brief,
      variants: result.data.variants,
      risk: {
        localScore: local.score,
        aiScore: result.data.risk.score,
        mergedScore: merged.score,
        flags: merged.flags,
        level: merged.level,
      },
    };
  });

// ── 3) Thin helpers (테스트·재사용) ───────────────────────────
export const composePromoBrief = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ brief: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    // 1 call SSOT — variants와 함께 brief 정제가 진행되므로 단독 호출은 echo만 수행.
    return { ok: true as const, brief: data.brief.trim() };
  });

export const scanPromoRisk = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const local = scanRiskLocal(data.text);
    return {
      ok: true as const,
      score: local.score,
      flags: local.flags,
      level: local.level,
    };
  });

// ── 4) translate stub (UI 미노출) ─────────────────────────────
export const translatePromo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ text: z.string().min(1), to: z.enum(["ko", "en"]) }).parse(d),
  )
  .handler(async (): Promise<{ ok: false; code: AiErrorCode | "NOT_IMPLEMENTED" }> => {
    return { ok: false, code: "NOT_IMPLEMENTED" };
  });

// ── 5) listings (기존 lib/api 유지) ───────────────────────────
export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return { campaigns: [] as string[] };
  const campaigns = await promoListCampaigns();
  return { campaigns };
});

export const listDispatches = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return { dispatches: [] as string[] };
  const dispatches = await promoListDispatches();
  return { dispatches };
});

export const listAssets = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return { assets: [] as string[] };
  const assets = await promoListAssets();
  return { assets };
});

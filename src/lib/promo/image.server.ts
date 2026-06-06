/**
 * Phase Z-2 — promo image generation (server-only).
 *
 * Provider: Gemini image-capable endpoint (default model `gemini-2.5-flash-image-preview`)
 * Flash *text* model image generation is forbidden — explicit model SSOT.
 * Envelope: { ok:true, data:{ base64, mimeType } } | { ok:false, code }.
 *
 * Reads process.env inside handler (Workers safe).
 */
import process from "node:process";

export type ImageErrorCode =
  | "IMAGE_NOT_CONFIGURED"
  | "IMAGE_RATE_LIMITED"
  | "IMAGE_TIMEOUT"
  | "IMAGE_ERROR";

export type ImageEnvelope =
  | { ok: true; data: { base64: string; mimeType: string }; provider: "gemini-image" }
  | { ok: false; code: ImageErrorCode; message?: string };

const DEFAULT_MODEL = "gemini-2.5-flash-image-preview";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 45_000;

export interface ImageProvider {
  apiKey: string;
  model: string;
}

export function resolveImageProvider(): ImageProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  // SSOT: never use Flash text model for images.
  if (/flash$/i.test(model) && !/image/i.test(model)) {
    return null;
  }
  return { apiKey: key, model };
}

export async function streamPromoImage(
  prompt: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ImageEnvelope> {
  const provider = resolveImageProvider();
  if (!provider) return { ok: false, code: "IMAGE_NOT_CONFIGURED" };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  try {
    const url = `${ENDPOINT}/${encodeURIComponent(provider.model)}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": provider.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
    if (res.status === 429) return { ok: false, code: "IMAGE_RATE_LIMITED" };
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        code: "IMAGE_ERROR",
        message: `gemini ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
      }>;
    };
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p) => p.inlineData?.data);
    const base64 = inline?.inlineData?.data;
    const mimeType = inline?.inlineData?.mimeType || "image/png";
    if (!base64) {
      return { ok: false, code: "IMAGE_ERROR", message: "empty image candidate" };
    }
    return { ok: true, provider: "gemini-image", data: { base64, mimeType } };
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return { ok: false, code: "IMAGE_TIMEOUT" };
    return { ok: false, code: "IMAGE_ERROR", message: (e as Error)?.message };
  } finally {
    clearTimeout(timer);
  }
}

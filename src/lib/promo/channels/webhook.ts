/**
 * Generic webhook channel adapter (Zapier / Discord / Slack incoming webhook).
 * Outbound URL MUST pass SSRF guard.
 */
import { assertSafeUrl } from "@/lib/promo/ssrf";
import type { ChannelAdapter, ChannelResult, ChannelSendInput } from "./types";

async function postJson(url: string, body: unknown, signal?: AbortSignal): Promise<ChannelResult> {
  try {
    assertSafeUrl(url);
  } catch (e) {
    return { ok: false, code: "SSRF_BLOCKED", message: (e as Error)?.message };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, code: "CHANNEL_ERROR", message: `${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, message: "ok" };
  } catch (e) {
    return { ok: false, code: "CHANNEL_ERROR", message: (e as Error)?.message };
  }
}

export function buildWebhookAdapter(channel: ChannelAdapter["id"]): ChannelAdapter {
  return {
    id: channel,
    async send({ variant, targetUrl, settings }: ChannelSendInput) {
      const url = settings.webhookUrl;
      if (!url) return { ok: false, code: "CONFIG_MISSING", message: "webhookUrl missing" };
      return postJson(url, {
        channel,
        body: variant.body,
        hashtags: variant.hashtags,
        cta: variant.cta,
        imageUrl: variant.imageUrl,
        targetUrl,
      });
    },
    async verify({ settings }) {
      const url = settings.webhookUrl;
      if (!url) return { ok: false, code: "CONFIG_MISSING", message: "webhookUrl missing" };
      try {
        assertSafeUrl(url);
      } catch (e) {
        return { ok: false, code: "SSRF_BLOCKED", message: (e as Error)?.message };
      }
      return { ok: true, message: "url ok" };
    },
  };
}

/** Direct exported send used by unit tests. */
export async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ChannelResult> {
  return postJson(url, payload, signal);
}

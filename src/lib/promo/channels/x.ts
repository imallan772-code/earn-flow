/**
 * X (Twitter) API v2 adapter — OAuth 2.0 user access token in promo_settings.default_utm.
 */
import { resolveOAuthApp } from "@/lib/promo/oauth/config.server";
import { formatXPostText } from "@/lib/promo/oauth/formatPost";
import type { ChannelAdapter, ChannelResult, ChannelSendInput } from "./types";

export const xAdapter: ChannelAdapter = {
  id: "x",
  async send({ variant, targetUrl, settings }) {
    const token = settings.xAccessToken;
    if (!token) {
      return { ok: false, code: "OAUTH_REQUIRED", message: "X account not connected" };
    }
    const text = formatXPostText(variant, targetUrl);
    try {
      const res = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { ok: false, code: "CHANNEL_ERROR", message: `${res.status}: ${txt.slice(0, 200)}` };
      }
      const json = (await res.json()) as { data?: { id?: string } };
      return { ok: true, externalId: json.data?.id, message: "posted" };
    } catch (e) {
      return { ok: false, code: "CHANNEL_ERROR", message: (e as Error)?.message };
    }
  },
  async verify({ settings }) {
    if (!resolveOAuthApp("x")) {
      return { ok: false, code: "CONFIG_MISSING", message: "X_CLIENT_ID/SECRET not configured" };
    }
    const token = settings.xAccessToken;
    if (!token) {
      return { ok: false, code: "OAUTH_REQUIRED", message: "X account not connected" };
    }
    try {
      const res = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, code: "CHANNEL_ERROR", message: `${res.status}` };
      return { ok: true, message: "x connected" };
    } catch (e) {
      return { ok: false, code: "CHANNEL_ERROR", message: (e as Error)?.message };
    }
  },
};

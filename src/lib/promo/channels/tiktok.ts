/**
 * TikTok adapter — OAuth verify; text post via Content API is video-only (NOT_IMPLEMENTED on send).
 */
import { resolveOAuthApp } from "@/lib/promo/oauth/config.server";
import type { ChannelAdapter } from "./types";

export const tiktokAdapter: ChannelAdapter = {
  id: "tiktok",
  async send() {
    return {
      ok: false,
      code: "NOT_IMPLEMENTED",
      message: "TikTok text post requires video Content Posting API — use copy channel for captions",
    };
  },
  async verify({ settings }) {
    if (!resolveOAuthApp("tiktok")) {
      return {
        ok: false,
        code: "CONFIG_MISSING",
        message: "TIKTOK_CLIENT_KEY/SECRET not configured",
      };
    }
    const token = settings.tiktokAccessToken;
    if (!token) {
      return { ok: false, code: "OAUTH_REQUIRED", message: "TikTok account not connected" };
    }
    try {
      const res = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return { ok: false, code: "CHANNEL_ERROR", message: `${res.status}` };
      return { ok: true, message: "tiktok connected" };
    } catch (e) {
      return { ok: false, code: "CHANNEL_ERROR", message: (e as Error)?.message };
    }
  },
};

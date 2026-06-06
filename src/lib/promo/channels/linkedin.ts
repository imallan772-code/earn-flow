/**
 * LinkedIn UGC Posts adapter — OAuth w_member_social.
 */
import { resolveOAuthApp } from "@/lib/promo/oauth/config.server";
import { formatChannelPostText } from "@/lib/promo/oauth/formatPost";
import type { ChannelAdapter, ChannelResult, ChannelSendInput } from "./types";

export const linkedinAdapter: ChannelAdapter = {
  id: "linkedin",
  async send({ variant, targetUrl, settings }) {
    const token = settings.linkedinAccessToken;
    const author = settings.linkedinMemberUrn;
    if (!token) {
      return { ok: false, code: "OAUTH_REQUIRED", message: "LinkedIn account not connected" };
    }
    if (!author) {
      return { ok: false, code: "CONFIG_MISSING", message: "linkedinMemberUrn missing — reconnect" };
    }
    const text = formatChannelPostText({ variant, targetUrl, maxLen: 3000 });
    try {
      const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text },
              shareMediaCategory: "NONE",
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { ok: false, code: "CHANNEL_ERROR", message: `${res.status}: ${txt.slice(0, 200)}` };
      }
      const id = res.headers.get("x-restli-id") ?? undefined;
      return { ok: true, externalId: id, message: "posted" };
    } catch (e) {
      return { ok: false, code: "CHANNEL_ERROR", message: (e as Error)?.message };
    }
  },
  async verify({ settings }) {
    if (!resolveOAuthApp("linkedin")) {
      return {
        ok: false,
        code: "CONFIG_MISSING",
        message: "LINKEDIN_CLIENT_ID/SECRET not configured",
      };
    }
    const token = settings.linkedinAccessToken;
    if (!token) {
      return { ok: false, code: "OAUTH_REQUIRED", message: "LinkedIn account not connected" };
    }
    try {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, code: "CHANNEL_ERROR", message: `${res.status}` };
      return { ok: true, message: "linkedin connected" };
    } catch (e) {
      return { ok: false, code: "CHANNEL_ERROR", message: (e as Error)?.message };
    }
  },
};

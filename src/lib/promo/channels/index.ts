/**
 * Channel adapter registry — Z-2.
 * webhook / telegram: real adapters. x/linkedin/tiktok: OAuth stubs.
 */
import type { PromoChannelId } from "@/features/admin/promo/types";
import type { ChannelAdapter, ChannelResult } from "./types";
import { buildWebhookAdapter } from "./webhook";
import { telegramAdapter } from "./telegram";
import { resendAdapter } from "./resend";

function oauthStub(id: PromoChannelId): ChannelAdapter {
  return {
    id,
    async send() {
      return { ok: false, code: "OAUTH_REQUIRED", message: `${id} OAuth Cursor 큐` };
    },
    async verify() {
      return { ok: false, code: "OAUTH_REQUIRED", message: `${id} OAuth Cursor 큐` };
    },
  };
}

export function getChannelAdapter(channel: PromoChannelId): ChannelAdapter {
  switch (channel) {
    case "telegram":
      return telegramAdapter;
    case "discord":
    case "slack":
    case "zapier":
    case "copy":
      return buildWebhookAdapter(channel);
    case "resend":
      return resendAdapter;
    case "x":
    case "linkedin":
    case "tiktok":
      return oauthStub(channel);
  }
}

export type { ChannelAdapter, ChannelResult };

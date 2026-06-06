/**
 * Channel adapter registry — Z-2.
 * webhook / telegram: real adapters. x/linkedin/tiktok: OAuth adapters (Z-OAuth).
 */
import type { PromoChannelId } from "@/features/admin/promo/types";
import type { ChannelAdapter, ChannelResult } from "./types";
import { buildWebhookAdapter } from "./webhook";
import { telegramAdapter } from "./telegram";
import { resendAdapter } from "./resend";
import { xAdapter } from "./x";
import { linkedinAdapter } from "./linkedin";
import { tiktokAdapter } from "./tiktok";

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
      return xAdapter;
    case "linkedin":
      return linkedinAdapter;
    case "tiktok":
      return tiktokAdapter;
  }
}

export type { ChannelAdapter, ChannelResult };

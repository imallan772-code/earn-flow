import type { PromoChannelId, PromoVariant } from "@/features/admin/promo/types";

export type ChannelErrorCode =
  | "OAUTH_REQUIRED"
  | "NOT_IMPLEMENTED"
  | "SSRF_BLOCKED"
  | "CONFIG_MISSING"
  | "CHANNEL_ERROR";

export type ChannelResult =
  | { ok: true; externalId?: string; message?: string }
  | { ok: false; code: ChannelErrorCode; message?: string };

export interface ChannelSettings {
  webhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  xAccessToken?: string;
  xRefreshToken?: string;
  linkedinAccessToken?: string;
  linkedinRefreshToken?: string;
  linkedinMemberUrn?: string;
  tiktokAccessToken?: string;
  tiktokRefreshToken?: string;
  tiktokOpenId?: string;
}

export interface ChannelSendInput {
  channel: PromoChannelId;
  variant: PromoVariant;
  targetUrl: string;
  settings: ChannelSettings;
}

export interface ChannelAdapter {
  id: PromoChannelId;
  send(input: ChannelSendInput): Promise<ChannelResult>;
  /** Dry-run / verification call — no real publishing. */
  verify(input: { settings: ChannelSettings }): Promise<ChannelResult>;
}

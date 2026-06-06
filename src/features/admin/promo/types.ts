/**
 * Phase Z-0 local stubs.
 * Cursor Z-DB가 supabase types를 생성하면 그때 교체. 절대 supabase types.ts import 금지.
 */
export type PromoChannelId =
  | "telegram"
  | "discord"
  | "slack"
  | "x"
  | "linkedin"
  | "tiktok"
  | "resend"
  | "zapier"
  | "copy";

export type PromoStatus = "draft" | "scheduled" | "publishing" | "done" | "failed";

export interface PromoVariant {
  id: string;
  channel: PromoChannelId;
  body: string;
  hashtags: string[];
  cta?: string;
  weight: number;
  /** Z-1: 이미지 생성용 프롬프트 텍스트 */
  imagePrompt?: string;
  /** Z-2: 생성된 이미지 URL (data URL or Storage URL). features mapCampaign SSOT. */
  imageUrl?: string;
}

export interface PromoCampaign {
  id: string;
  title: string;
  brief: string;
  targetUrl: string;
  channels: PromoChannelId[];
  variants: PromoVariant[];
  scheduledAt: string; // ISO
  status: PromoStatus;
  riskScore: number;
  heroAssetId?: string;
}

export interface PromoDispatch {
  id: string;
  campaignId: string;
  channel: PromoChannelId;
  variantId: string;
  sentAt: string;
  status: "sent" | "failed" | "queued";
  error?: string;
}

export interface PromoClick {
  id: string;
  campaignId: string;
  channel: PromoChannelId;
  ts: string;
  ref?: string;
}

export interface PromoAsset {
  id: string;
  kind: "image" | "video" | "copy";
  url: string;
  alt?: string;
  createdAt: string;
}

export interface PromoSettings {
  webhookUrl: string;
  hmacSecret: string;
  defaultUtmSource: string;
  /** Z-2: Telegram Bot API token (default_utm JSON SSOT, no DB migration). */
  telegramBotToken?: string;
  /** Z-2: Telegram chat id (number or @channel). */
  telegramChatId?: string;
  /** Z-OAuth: connected flags only (tokens stay server-side in default_utm). */
  xConnected?: boolean;
  linkedinConnected?: boolean;
  tiktokConnected?: boolean;
}

import { PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";

export const CHANNEL_LABELS = PROMO_CHANNEL_LABELS_KO as Record<PromoChannelId, string>;

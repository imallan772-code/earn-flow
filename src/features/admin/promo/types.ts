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
  /** Z-1: 이미지 생성용 프롬프트 텍스트 (실제 생성은 Z-2) */
  imagePrompt?: string;
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
}

import { PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";

export const CHANNEL_LABELS = PROMO_CHANNEL_LABELS_KO as Record<PromoChannelId, string>;

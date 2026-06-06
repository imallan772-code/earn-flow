import { z } from "zod";

export const promoChannelIdSchema = z.enum([
  "telegram",
  "discord",
  "slack",
  "x",
  "linkedin",
  "tiktok",
  "resend",
  "zapier",
  "copy",
]);

export const promoStatusSchema = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "done",
  "failed",
]);

export const promoVariantRowSchema = z.object({
  id: z.string(),
  campaign_id: z.string(),
  label: z.string(),
  channel: z.string(),
  body: z.string(),
  hashtags: z.array(z.string()).nullable().optional(),
  cta: z.string().nullable().optional(),
  weight: z.union([z.number(), z.string()]).transform(Number),
  image_url: z.string().nullable().optional(),
  utm: z.record(z.unknown()).nullable().optional(),
});

export const promoCampaignRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  target_url: z.string(),
  brief: z.record(z.unknown()).nullable().optional(),
  goal: z.string().nullable().optional(),
  audience: z.string().nullable().optional(),
  tone: z.union([z.number(), z.string(), z.null()]).optional(),
  length: z.string().nullable().optional(),
  channels: z.array(z.string()).nullable().optional(),
  status: promoStatusSchema,
  scheduled_at: z.string().nullable().optional(),
  risk_score: z.union([z.number(), z.string()]).transform(Number),
  hero_asset_id: z.string().nullable().optional(),
  ab_ratio: z.union([z.number(), z.string()]).transform(Number).optional(),
  variants: z.array(promoVariantRowSchema).optional(),
});

export const promoCampaignsSchema = z.array(promoCampaignRowSchema);

export const promoDispatchRowSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string(),
  variant_id: z.string().nullable().optional(),
  channel: z.string(),
  status: z.enum(["queued", "sent", "failed"]),
  external_id: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  sent_at: z.string(),
});

export const promoDispatchesSchema = z.array(promoDispatchRowSchema);

export const promoAssetRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["image", "video", "copy"]),
  url: z.string(),
  alt: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  campaign_id: z.string().nullable().optional(),
  created_at: z.string(),
});

export const promoAssetsSchema = z.array(promoAssetRowSchema);

export const promoSettingsRowSchema = z.object({
  id: z.string(),
  brand_voice: z.string(),
  banned_words: z.array(z.string()).nullable().optional(),
  default_utm: z.record(z.unknown()).nullable().optional(),
  quiet_hours: z.record(z.unknown()).nullable().optional(),
  ab_ratio: z.union([z.number(), z.string()]).transform(Number).optional(),
});

export const promoAnalyticsSummarySchema = z.object({
  sent: z.number(),
  clicks: z.number(),
  campaigns: z.number(),
  top_channel: z.string().nullable().optional(),
});

export const promoCampaignUpsertSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).optional(),
  title: z.string(),
  target_url: z.string().optional(),
  targetUrl: z.string().optional(),
  brief: z.union([z.string(), z.record(z.unknown())]).optional(),
  goal: z.string().optional(),
  audience: z.string().optional(),
  tone: z.number().optional(),
  length: z.string().optional(),
  channels: z.array(promoChannelIdSchema),
  status: promoStatusSchema.optional(),
  scheduled_at: z.string().optional(),
  risk_score: z.number().optional(),
  hero_asset_id: z.string().optional(),
  ab_ratio: z.number().min(0).max(1).optional(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        channel: promoChannelIdSchema,
        body: z.string(),
        hashtags: z.array(z.string()).optional(),
        cta: z.string().optional(),
        weight: z.number().optional(),
        image_url: z.string().optional(),
        utm: z.record(z.string()).optional(),
      }),
    )
    .optional(),
});

export const promoSettingsUpsertSchema = z.object({
  brand_voice: z.string().optional(),
  banned_words: z.array(z.string()).optional(),
  default_utm: z.record(z.unknown()).optional(),
  quiet_hours: z.record(z.unknown()).optional(),
  ab_ratio: z.number().min(0).max(1).optional(),
});

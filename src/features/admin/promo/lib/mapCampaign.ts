import type { PromoCampaign } from "../types";

/** Map UI campaign → admin_upsert_promo_campaign payload (lib/api/promo). */
export function campaignToUpsertPayload(c: PromoCampaign) {
  return {
    id: c.id,
    slug: c.id.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 64) || c.id,
    title: c.title,
    target_url: c.targetUrl,
    brief: c.brief,
    channels: c.channels,
    status: c.status,
    scheduled_at: c.scheduledAt,
    risk_score: c.riskScore,
    hero_asset_id: c.heroAssetId,
    variants: c.variants.map((v) => ({
      id: v.id,
      channel: v.channel,
      body: v.body,
      hashtags: v.hashtags,
      cta: v.cta,
      weight: v.weight,
      utm: v.imagePrompt ? { imagePrompt: v.imagePrompt } : {},
    })),
  };
}

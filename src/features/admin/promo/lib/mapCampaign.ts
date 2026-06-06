import type { PromoCampaign, PromoVariant } from "../types";

/**
 * Z-2 mapCampaign SSOT — `image_url ↔ variant.imageUrl`.
 * features `lib/` 하위. `src/lib/api/promo.ts` 수정 0 (read-back은 Cursor TODO).
 */
export function variantToPayload(v: PromoVariant) {
  const utm: Record<string, unknown> = {};
  if (v.imagePrompt) utm.imagePrompt = v.imagePrompt;
  return {
    id: v.id,
    channel: v.channel,
    body: v.body,
    hashtags: v.hashtags,
    cta: v.cta,
    weight: v.weight,
    image_url: v.imageUrl,
    utm,
  };
}

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
    variants: c.variants.map(variantToPayload),
  };
}

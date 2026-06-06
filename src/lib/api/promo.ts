/**
 * Promo API — admin RPC wrappers (Cursor Z-DB).
 * Features import from here when isSupabaseConfigured(); else client mockStore.
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  PromoAsset,
  PromoCampaign,
  PromoChannelId,
  PromoDispatch,
  PromoSettings,
  PromoStatus,
  PromoVariant,
} from "@/features/admin/promo/types";
import {
  promoAnalyticsSummarySchema,
  promoAssetRowSchema,
  promoAssetsSchema,
  promoCampaignRowSchema,
  promoCampaignsSchema,
  promoCampaignUpsertSchema,
  promoDispatchRowSchema,
  promoDispatchesSchema,
  promoSettingsRowSchema,
  promoSettingsUpsertSchema,
} from "@/lib/api/promo/schemas";

function briefText(brief: unknown): string {
  if (typeof brief === "string") return brief;
  if (brief && typeof brief === "object" && "text" in brief) {
    return String((brief as { text: unknown }).text ?? "");
  }
  return "";
}

function toVariant(row: {
  id: string;
  channel: string;
  body: string;
  hashtags?: string[] | null;
  cta?: string | null;
  weight: number;
}): PromoVariant {
  return {
    id: row.id,
    channel: row.channel as PromoChannelId,
    body: row.body,
    hashtags: row.hashtags ?? [],
    cta: row.cta ?? undefined,
    weight: row.weight,
  };
}

function toCampaign(row: ReturnType<typeof promoCampaignRowSchema.parse>): PromoCampaign {
  const variants = (row.variants ?? []).map((v) =>
    toVariant({
      id: v.id,
      channel: v.channel,
      body: v.body,
      hashtags: v.hashtags,
      cta: v.cta,
      weight: v.weight,
    }),
  );
  return {
    id: row.id,
    title: row.title,
    brief: briefText(row.brief),
    targetUrl: row.target_url,
    channels: (row.channels ?? []) as PromoChannelId[],
    variants,
    scheduledAt: row.scheduled_at ?? new Date().toISOString(),
    status: row.status as PromoStatus,
    riskScore: row.risk_score,
    heroAssetId: row.hero_asset_id ?? undefined,
  };
}

function toDispatch(row: ReturnType<typeof promoDispatchRowSchema.parse>): PromoDispatch {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    channel: row.channel as PromoChannelId,
    variantId: row.variant_id ?? "",
    sentAt: row.sent_at,
    status: row.status === "queued" ? "queued" : row.status === "sent" ? "sent" : "failed",
    error: row.error ?? undefined,
  };
}

function toAsset(row: ReturnType<typeof promoAssetRowSchema.parse>): PromoAsset {
  return {
    id: row.id,
    kind: row.kind,
    url: row.url,
    alt: row.alt ?? undefined,
    createdAt: row.created_at,
  };
}

function toSettings(row: ReturnType<typeof promoSettingsRowSchema.parse>): PromoSettings {
  const utm = (row.default_utm ?? {}) as Record<string, string>;
  return {
    webhookUrl: utm.webhookUrl ?? "",
    hmacSecret: utm.hmacSecret ?? "",
    defaultUtmSource: utm.defaultUtmSource ?? utm.utm_source ?? "phonara-promo",
  };
}

function toUpsertPayload(input: ReturnType<typeof promoCampaignUpsertSchema.parse>) {
  return {
    id: input.id,
    slug: input.slug ?? input.id,
    title: input.title,
    target_url: input.target_url ?? input.targetUrl ?? "",
    brief:
      typeof input.brief === "string" ? { text: input.brief } : (input.brief ?? { text: "" }),
    goal: input.goal,
    audience: input.audience,
    tone: input.tone,
    length: input.length,
    channels: input.channels,
    status: input.status,
    scheduled_at: input.scheduled_at,
    risk_score: input.risk_score,
    hero_asset_id: input.hero_asset_id,
    ab_ratio: input.ab_ratio,
    variants: input.variants?.map((v) => ({
      id: v.id,
      label: v.label ?? "A",
      channel: v.channel,
      body: v.body,
      hashtags: v.hashtags ?? [],
      cta: v.cta,
      weight: v.weight ?? 1,
      image_url: v.image_url,
      utm: v.utm ?? {},
    })),
  };
}

export async function promoListCampaigns(): Promise<PromoCampaign[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_promo_campaigns");
  if (error) throw error;
  return promoCampaignsSchema.parse(data ?? []).map(toCampaign);
}

export async function promoUpsertCampaign(input: unknown): Promise<PromoCampaign> {
  const payload = promoCampaignUpsertSchema.parse(input);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_upsert_promo_campaign", {
    p_payload: toUpsertPayload(payload) as Json,
  });
  if (error) throw error;
  return toCampaign(promoCampaignRowSchema.parse(data));
}

export async function promoDeleteCampaign(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_delete_promo_campaign", { p_id: id });
  if (error) throw error;
}

export async function promoListDispatches(campaignId?: string): Promise<PromoDispatch[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_promo_dispatches", {
    p_campaign_id: campaignId,
  });
  if (error) throw error;
  return promoDispatchesSchema.parse(data ?? []).map(toDispatch);
}

export async function promoRecordDispatch(input: {
  campaignId: string;
  variantId?: string;
  channel: PromoChannelId;
  status?: "queued" | "sent" | "failed";
  externalId?: string;
  error?: string;
  sentAt?: string;
}): Promise<PromoDispatch> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_record_promo_dispatch", {
    p_payload: {
      campaign_id: input.campaignId,
      variant_id: input.variantId,
      channel: input.channel,
      status: input.status ?? "sent",
      external_id: input.externalId,
      error: input.error,
      sent_at: input.sentAt,
    },
  });
  if (error) throw error;
  return toDispatch(promoDispatchRowSchema.parse(data));
}

export async function promoListAssets(): Promise<PromoAsset[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_promo_assets");
  if (error) throw error;
  return promoAssetsSchema.parse(data ?? []).map(toAsset);
}

export async function promoGetSettings(): Promise<PromoSettings> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_get_promo_settings");
  if (error) throw error;
  return toSettings(promoSettingsRowSchema.parse(data));
}

export async function promoUpsertSettings(input: unknown): Promise<PromoSettings> {
  const payload = promoSettingsUpsertSchema.parse(input);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_upsert_promo_settings", {
    p_payload: {
      brand_voice: payload.brand_voice,
      banned_words: payload.banned_words,
      default_utm: payload.default_utm,
      quiet_hours: payload.quiet_hours,
      ab_ratio: payload.ab_ratio,
    } as Json,
  });
  if (error) throw error;
  return toSettings(promoSettingsRowSchema.parse(data));
}

export async function promoAnalyticsSummary() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_promo_analytics_summary");
  if (error) throw error;
  return promoAnalyticsSummarySchema.parse(data);
}

export async function recordPromoClick(input: {
  slug: string;
  channel?: string;
  variantId?: string;
  referrer?: string;
  uaHash?: string;
  ipHash?: string;
}): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("record_promo_click", {
    p_slug: input.slug,
    p_channel: input.channel ?? "unknown",
    p_variant_id: input.variantId,
    p_referrer: input.referrer,
    p_ua_hash: input.uaHash,
    p_ip_hash: input.ipHash,
  });
  if (error) {
    console.warn("[promo] record_promo_click:", error.message);
    return null;
  }
  return data as string;
}

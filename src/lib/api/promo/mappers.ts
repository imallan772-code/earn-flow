import type {
  PromoCampaign,
  PromoChannelId,
  PromoSettings,
  PromoStatus,
  PromoVariant,
} from "@/features/admin/promo/types";

function briefText(brief: unknown): string {
  if (typeof brief === "string") return brief;
  if (brief && typeof brief === "object" && "text" in brief) {
    return String((brief as { text: unknown }).text ?? "");
  }
  return "";
}

export function mapPromoVariantRow(row: {
  id: string;
  channel: string;
  body: string;
  hashtags?: string[] | null;
  cta?: string | null;
  weight: number;
  image_url?: string | null;
  utm?: Record<string, unknown> | null;
}): PromoVariant {
  const utm = row.utm ?? undefined;
  const imagePrompt =
    utm && typeof utm.imagePrompt === "string" ? utm.imagePrompt : undefined;
  return {
    id: row.id,
    channel: row.channel as PromoChannelId,
    body: row.body,
    hashtags: row.hashtags ?? [],
    cta: row.cta ?? undefined,
    weight: row.weight,
    imagePrompt,
    imageUrl: row.image_url ?? undefined,
  };
}

export function mapPromoSettingsRow(utm: Record<string, string>): PromoSettings {
  return {
    webhookUrl: utm.webhookUrl ?? "",
    hmacSecret: utm.hmacSecret ?? "",
    defaultUtmSource: utm.defaultUtmSource ?? utm.utm_source ?? "phonara-promo",
    telegramBotToken: utm.telegramBotToken ?? undefined,
    telegramChatId: utm.telegramChatId ?? undefined,
  };
}

export function mapPromoCampaignRow(row: {
  id: string;
  title: string;
  target_url: string;
  brief?: Record<string, unknown> | null;
  channels?: string[] | null;
  scheduled_at?: string | null;
  status: string;
  risk_score: number | string;
  hero_asset_id?: string | null;
  variants?: Array<{
    id: string;
    channel: string;
    body: string;
    hashtags?: string[] | null;
    cta?: string | null;
    weight: number | string;
    image_url?: string | null;
    utm?: Record<string, unknown> | null;
  }> | null;
}): PromoCampaign {
  const variants = (row.variants ?? []).map((v) =>
    mapPromoVariantRow({
      id: v.id,
      channel: v.channel,
      body: v.body,
      hashtags: v.hashtags,
      cta: v.cta,
      weight: Number(v.weight),
      image_url: v.image_url,
      utm: v.utm,
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
    riskScore: Number(row.risk_score),
    heroAssetId: row.hero_asset_id ?? undefined,
  };
}

export function mapPromoSettingsFromRow(defaultUtm: Record<string, unknown> | null | undefined): PromoSettings {
  const utm = (defaultUtm ?? {}) as Record<string, string>;
  return mapPromoSettingsRow(utm);
}

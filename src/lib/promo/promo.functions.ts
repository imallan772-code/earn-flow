/**
 * Phase Z-1 — Promo server functions.
 *
 * - getPromoAiStatus : provider 상태 (키 노출 0)
 * - composePromoVariants : brief+variants+risk 단일 Gemini call (1 API call)
 * - composePromoBrief / scanPromoRisk : 테스트용 thin export
 * - translatePromo : UI 미노출 stub envelope
 *
 * server in-memory store 금지 (`new Map()` / module-level `let arr=[]` 금지).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import {
  promoGetChannelSettings,
  promoListAssets,
  promoListCampaigns,
  promoListDispatches,
  promoRecordDispatch,
} from "@/lib/api/promo";
import {
  callPromoBundle,
  resolveProvider,
  type AiErrorCode,
  type PromoAiProvider,
} from "./ai.server";
import { mergeRiskScores, scanRiskLocal } from "./risk";
import { getChannelAdapter } from "./channels";
import type { ChannelSettings } from "./channels/types";
import { publishPromoChannel, type PublishOneResult } from "./dispatch.server";
import { planDispatch } from "./dispatchTick";
import type { PromoAsset, PromoCampaign, PromoChannelId, PromoDispatch } from "@/features/admin/promo/types";

// ── 1) AI provider status (키 노출 0) ─────────────────────────
export const getPromoAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const r = resolveProvider();
  return {
    configured: r !== null,
    provider: (r?.provider ?? null) as PromoAiProvider | null,
  };
});

// ── 2) Compose variants (단일 1 call) ─────────────────────────
const CHANNEL_SCHEMA = z.enum([
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

const composeInputSchema = z.object({
  brief: z.string().min(1).max(2000),
  title: z.string().max(200).default(""),
  targetUrl: z.string().max(500).default(""),
  channels: z.array(CHANNEL_SCHEMA).min(1).max(9),
});

export const composePromoVariants = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => composeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await callPromoBundle({
      brief: data.brief,
      title: data.title,
      targetUrl: data.targetUrl,
      channels: data.channels as PromoChannelId[],
    });

    if (!result.ok) {
      return { ok: false as const, code: result.code, message: result.message };
    }

    // local risk + AI risk 병합
    const local = scanRiskLocal(`${data.title} ${data.brief}`);
    const merged = mergeRiskScores(local, result.data.risk);

    return {
      ok: true as const,
      provider: result.provider,
      brief: result.data.brief,
      variants: result.data.variants,
      risk: {
        localScore: local.score,
        aiScore: result.data.risk.score,
        mergedScore: merged.score,
        flags: merged.flags,
        level: merged.level,
      },
    };
  });

// ── 3) Thin helpers (테스트·재사용) ───────────────────────────
export const composePromoBrief = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ brief: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    // 1 call SSOT — variants와 함께 brief 정제가 진행되므로 단독 호출은 echo만 수행.
    return { ok: true as const, brief: data.brief.trim() };
  });

export const scanPromoRisk = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const local = scanRiskLocal(data.text);
    return {
      ok: true as const,
      score: local.score,
      flags: local.flags,
      level: local.level,
    };
  });

// ── 4) translate stub (UI 미노출) ─────────────────────────────
export const translatePromo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ text: z.string().min(1), to: z.enum(["ko", "en"]) }).parse(d),
  )
  .handler(async (): Promise<{ ok: false; code: AiErrorCode | "NOT_IMPLEMENTED" }> => {
    return { ok: false, code: "NOT_IMPLEMENTED" };
  });

// ── 5) listings (기존 lib/api 유지) ───────────────────────────
export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return [] as PromoCampaign[];
  return promoListCampaigns();
});

export const listDispatches = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return [] as PromoDispatch[];
  return promoListDispatches();
});

export const listAssets = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return [] as PromoAsset[];
  return promoListAssets();
});

// ── 6) Z-2 channel adapters & publish ─────────────────────────
// 역할 분리 (UI 합쳐짐 금지):
//   publishPromoCampaign : 단건 발행 (CampaignTable 행 「발행」 전용)
//   runPromoCronTick     : scheduled due 캠페인 fan-out (ChannelMatrix 「지금 발행」 전용)

const CHANNEL_ENUM = z.enum([
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

const channelSettingsSchema = z
  .object({
    webhookUrl: z.string().max(2048).optional(),
    telegramBotToken: z.string().max(256).optional(),
    telegramChatId: z.string().max(128).optional(),
  })
  .partial();

async function resolveChannelSettings(
  partial?: z.infer<typeof channelSettingsSchema>,
): Promise<ChannelSettings> {
  if (!isSupabaseConfigured()) return partial ?? {};
  try {
    const full = await promoGetChannelSettings();
    return { ...full, ...partial };
  } catch {
    return partial ?? {};
  }
}

const publishInputSchema = z.object({
  campaignId: z.string().min(1).max(200),
  channel: CHANNEL_ENUM.optional(),
  settings: channelSettingsSchema.optional(),
});

async function recordAdminDispatch(input: {
  campaignId: string;
  variantId: string;
  channel: PromoChannelId;
  status: "sent" | "failed";
  error?: string;
  externalId?: string;
}) {
  await promoRecordDispatch({
    campaignId: input.campaignId,
    variantId: input.variantId,
    channel: input.channel,
    status: input.status,
    error: input.error,
    externalId: input.externalId,
  });
}

/** 단건 발행 — CampaignTable 행 「발행」 전용. */
export const publishPromoCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publishInputSchema.parse(d))
  .handler(async ({ data }) => {
    if (!isSupabaseConfigured()) {
      return {
        ok: false as const,
        code: "DB_NOT_CONFIGURED" as const,
        results: [] as PublishOneResult[],
      };
    }
    const campaigns = await promoListCampaigns();
    const campaign = campaigns.find((c) => c.id === data.campaignId);
    if (!campaign) {
      return { ok: false as const, code: "CAMPAIGN_NOT_FOUND" as const, results: [] as PublishOneResult[] };
    }
    const targetChannels: PromoChannelId[] = data.channel
      ? [data.channel as PromoChannelId]
      : campaign.channels;
    const settings = await resolveChannelSettings(data.settings);
    const results = await Promise.all(
      targetChannels.map((ch) =>
        publishPromoChannel(campaign, ch, settings, recordAdminDispatch),
      ),
    );
    const sent = results.filter((r) => r.ok).length;
    return { ok: true as const, sent, failed: results.length - sent, results };
  });

/** scheduled due 캠페인 fan-out — ChannelMatrix 「지금 발행」 전용. cron route에서 호출 금지. */
export const runPromoCronTick = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ settings: channelSettingsSchema.optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    if (!isSupabaseConfigured()) {
      return {
        ok: false as const,
        code: "DB_NOT_CONFIGURED" as const,
        enqueued: 0,
        sent: 0,
        failed: 0,
      };
    }
    const campaigns = await promoListCampaigns();
    const plan = planDispatch(campaigns);
    const settings = await resolveChannelSettings(data?.settings);
    const byId = new Map(campaigns.map((c) => [c.id, c]));
    const results = await Promise.all(
      plan.map(async (item) => {
        const c = byId.get(item.campaignId);
        if (!c) return null;
        return publishPromoChannel(c, item.channel, settings, recordAdminDispatch);
      }),
    );
    const ok = results.filter((r): r is PublishOneResult => r !== null);
    const sent = ok.filter((r) => r.ok).length;
    return {
      ok: true as const,
      enqueued: plan.length,
      sent,
      failed: ok.length - sent,
      results: ok,
    };
  });

/** 채널 verify/dry-run — ChannelMatrix 「연결 확인」. */
export const testChannel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        channel: CHANNEL_ENUM,
        settings: channelSettingsSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const adapter = getChannelAdapter(data.channel as PromoChannelId);
    const settings = await resolveChannelSettings(data.settings);
    const result = await adapter.verify({ settings });
    return result.ok
      ? { ok: true as const, message: result.message ?? "" }
      : { ok: false as const, code: result.code, message: result.message };
  });

/** Telegram settings slice — delegates to lib/api/promo `promoGetSettings`. */
export const getPromoSettingsExtended = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!isSupabaseConfigured()) {
      return { ok: true as const, telegramBotToken: "", telegramChatId: "" };
    }
    try {
      const { promoGetSettings } = await import("@/lib/api/promo");
      const s = await promoGetSettings();
      return {
        ok: true as const,
        telegramBotToken: s.telegramBotToken ?? "",
        telegramChatId: s.telegramChatId ?? "",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "RPC_ERROR";
      return { ok: false as const, code: "RPC_ERROR" as const, message };
    }
  },
);

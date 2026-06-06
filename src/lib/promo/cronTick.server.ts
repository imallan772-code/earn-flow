/**
 * Promo cron tick execution — service_role DB read + channel fan-out.
 * Invoked from /api/public/cron/promo-tick after HMAC verification.
 */
import {
  cronGetPromoSettings,
  cronListDuePromoCampaigns,
  cronMarkPromoCampaignStatus,
  cronRecordPromoDispatch,
} from "@/lib/api/promo/cron.server";
import { isServiceRoleConfigured } from "@/integrations/supabase/serviceRole.server";
import {
  channelSettingsFromPromoSettings,
  publishPromoChannel,
  type PublishOneResult,
} from "@/lib/promo/dispatch.server";
import { planDispatch } from "@/lib/promo/dispatchTick";

export interface CronTickResult {
  ok: boolean;
  code?: string;
  enqueued: number;
  sent: number;
  failed: number;
  results: PublishOneResult[];
}

export async function executePromoCronTick(now?: Date): Promise<CronTickResult> {
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      code: "SERVICE_ROLE_NOT_CONFIGURED",
      enqueued: 0,
      sent: 0,
      failed: 0,
      results: [],
    };
  }

  const campaigns = await cronListDuePromoCampaigns(now);
  const settingsRow = await cronGetPromoSettings();
  const settings = channelSettingsFromPromoSettings(settingsRow);
  const plan = planDispatch(campaigns, now ?? new Date());
  const byId = new Map(campaigns.map((c) => [c.id, c]));

  const recordDispatch = async (input: {
    campaignId: string;
    variantId: string;
    channel: import("@/features/admin/promo/types").PromoChannelId;
    status: "sent" | "failed";
    error?: string;
    externalId?: string;
  }) => {
    await cronRecordPromoDispatch({
      campaignId: input.campaignId,
      variantId: input.variantId,
      channel: input.channel,
      status: input.status,
      error: input.error,
      externalId: input.externalId,
    });
  };

  const results = await Promise.all(
    plan.map(async (item) => {
      const c = byId.get(item.campaignId);
      if (!c) return null;
      await cronMarkPromoCampaignStatus(c.id, "publishing");
      return publishPromoChannel(c, item.channel, settings, recordDispatch);
    }),
  );

  const okResults = results.filter((r): r is PublishOneResult => r !== null);
  const sent = okResults.filter((r) => r.ok).length;

  const touched = new Set(plan.map((p) => p.campaignId));
  await Promise.all(
    [...touched].map(async (id) => {
      const related = okResults.filter((r) => r.campaignId === id);
      const allOk = related.length > 0 && related.every((r) => r.ok);
      const anyOk = related.some((r) => r.ok);
      const status = allOk ? "done" : anyOk ? "done" : "failed";
      await cronMarkPromoCampaignStatus(id, status);
    }),
  );

  return {
    ok: true,
    enqueued: plan.length,
    sent,
    failed: okResults.length - sent,
    results: okResults,
  };
}

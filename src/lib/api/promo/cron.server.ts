/**
 * Promo cron RPC wrappers — service_role only (Cursor).
 * Called from /api/public/cron/promo-tick after HMAC verify.
 */
import type { Json } from "@/integrations/supabase/types";
import { getServiceRoleClient } from "@/integrations/supabase/serviceRole.server";
import type { PromoCampaign, PromoChannelId, PromoSettings } from "@/features/admin/promo/types";
import {
  mapPromoCampaignRow,
  mapPromoSettingsFromRow,
} from "@/lib/api/promo/mappers";
import { promoCampaignRowSchema, promoCampaignsSchema } from "@/lib/api/promo/schemas";

export async function cronListDuePromoCampaigns(now?: Date): Promise<PromoCampaign[]> {
  const supabase = getServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  const { data, error } = await supabase.rpc("cron_list_due_promo_campaigns", {
    p_now: (now ?? new Date()).toISOString(),
  });
  if (error) throw error;
  return promoCampaignsSchema.parse(data ?? []).map((row) =>
    mapPromoCampaignRow(promoCampaignRowSchema.parse(row)),
  );
}

export async function cronGetPromoSettings(): Promise<PromoSettings> {
  const supabase = getServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  const { data, error } = await supabase.rpc("cron_get_promo_settings");
  if (error) throw error;
  const row = (data ?? {}) as { default_utm?: Record<string, unknown> | null };
  return mapPromoSettingsFromRow(row.default_utm);
}

export async function cronRecordPromoDispatch(input: {
  campaignId: string;
  variantId?: string;
  channel: PromoChannelId;
  status?: "queued" | "sent" | "failed";
  externalId?: string;
  error?: string;
  sentAt?: string;
}): Promise<void> {
  const supabase = getServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  const { error } = await supabase.rpc("cron_record_promo_dispatch", {
    p_payload: {
      campaign_id: input.campaignId,
      variant_id: input.variantId,
      channel: input.channel,
      status: input.status ?? "sent",
      external_id: input.externalId,
      error: input.error,
      sent_at: input.sentAt,
    } as Json,
  });
  if (error) throw error;
}

export async function cronMarkPromoCampaignStatus(
  campaignId: string,
  status: "draft" | "scheduled" | "publishing" | "done" | "failed",
): Promise<void> {
  const supabase = getServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  const { error } = await supabase.rpc("cron_mark_promo_campaign_status", {
    p_id: campaignId,
    p_status: status,
  });
  if (error) throw error;
}

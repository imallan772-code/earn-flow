/**
 * Shared promo channel dispatch — admin server fn + cron route.
 */
import type { PromoCampaign, PromoChannelId } from "@/features/admin/promo/types";
import { getChannelAdapter } from "@/lib/promo/channels";
import type { ChannelSettings } from "@/lib/promo/channels/types";

export interface PublishOneResult {
  campaignId: string;
  channel: PromoChannelId;
  variantId: string;
  ok: boolean;
  code?: string;
  message?: string;
}

export type RecordDispatchFn = (input: {
  campaignId: string;
  variantId: string;
  channel: PromoChannelId;
  status: "sent" | "failed";
  error?: string;
  externalId?: string;
}) => Promise<void>;

export async function publishPromoChannel(
  campaign: PromoCampaign,
  channel: PromoChannelId,
  settings: ChannelSettings,
  recordDispatch?: RecordDispatchFn,
): Promise<PublishOneResult> {
  const variant =
    campaign.variants.find((v) => v.channel === channel) ?? campaign.variants[0];
  if (!variant) {
    return {
      campaignId: campaign.id,
      channel,
      variantId: "",
      ok: false,
      code: "NO_VARIANT",
    };
  }

  const adapter = getChannelAdapter(channel);
  const result = await adapter.send({
    channel,
    variant,
    targetUrl: campaign.targetUrl,
    settings,
  });

  if (recordDispatch) {
    try {
      await recordDispatch({
        campaignId: campaign.id,
        variantId: variant.id,
        channel,
        status: result.ok ? "sent" : "failed",
        error: result.ok
          ? undefined
          : `${result.code}${result.message ? `: ${result.message}` : ""}`,
        externalId: result.ok ? result.externalId : undefined,
      });
    } catch {
      /* best-effort audit */
    }
  }

  return {
    campaignId: campaign.id,
    channel,
    variantId: variant.id,
    ok: result.ok,
    code: result.ok ? undefined : result.code,
    message: result.message,
  };
}

export function channelSettingsFromPromoSettings(s: {
  webhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  xAccessToken?: string;
  xRefreshToken?: string;
  linkedinAccessToken?: string;
  linkedinRefreshToken?: string;
  linkedinMemberUrn?: string;
  tiktokAccessToken?: string;
  tiktokRefreshToken?: string;
  tiktokOpenId?: string;
}): ChannelSettings {
  return {
    webhookUrl: s.webhookUrl,
    telegramBotToken: s.telegramBotToken,
    telegramChatId: s.telegramChatId,
    xAccessToken: s.xAccessToken,
    xRefreshToken: s.xRefreshToken,
    linkedinAccessToken: s.linkedinAccessToken,
    linkedinRefreshToken: s.linkedinRefreshToken,
    linkedinMemberUrn: s.linkedinMemberUrn,
    tiktokAccessToken: s.tiktokAccessToken,
    tiktokRefreshToken: s.tiktokRefreshToken,
    tiktokOpenId: s.tiktokOpenId,
  };
}

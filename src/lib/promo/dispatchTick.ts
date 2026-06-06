/**
 * Phase Z-2 — pure scheduler logic for cron tick.
 * No I/O. Given a list of campaigns and `now`, returns the dispatch plan.
 */
import type { PromoCampaign, PromoChannelId } from "@/features/admin/promo/types";

export interface DispatchPlanItem {
  campaignId: string;
  channel: PromoChannelId;
  variantId: string;
}

export function planDispatch(
  campaigns: PromoCampaign[],
  now: Date = new Date(),
): DispatchPlanItem[] {
  const out: DispatchPlanItem[] = [];
  const ts = now.getTime();
  for (const c of campaigns) {
    if (c.status !== "scheduled") continue;
    const at = Date.parse(c.scheduledAt);
    if (!Number.isFinite(at) || at > ts) continue;
    for (const channel of c.channels) {
      const variant =
        c.variants.find((v) => v.channel === channel) ?? c.variants[0];
      if (!variant) continue;
      out.push({ campaignId: c.id, channel, variantId: variant.id });
    }
  }
  return out;
}

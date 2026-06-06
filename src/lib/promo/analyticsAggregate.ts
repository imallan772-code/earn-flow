/**
 * Promo analytics aggregation — pure functions.
 * SSOT: dispatches[] (+ campaigns[] join). clicks row-level은 Cursor RPC 후.
 */
import type {
  PromoCampaign,
  PromoChannelId,
  PromoDispatch,
} from "@/features/admin/promo/types";
import { ymdKey } from "./calendarGrid";

export type PeriodKey = "7d" | "30d" | "all";

export interface PeriodRange {
  from: Date | null;
  to: Date | null;
}

export interface ChannelBreakdownRow {
  channel: PromoChannelId;
  count: number;
  pct: number;
}

export interface DailyBucket {
  ymd: string;
  count: number;
}

export function periodRange(now: Date, key: PeriodKey): PeriodRange {
  if (key === "all") return { from: null, to: null };
  const days = key === "7d" ? 7 : 30;
  const from = new Date(now.getTime() - days * 86_400_000);
  return { from, to: now };
}

export function filterByPeriod<T>(
  items: T[],
  getDate: (item: T) => string | Date,
  from: Date | null,
  to: Date | null,
): T[] {
  if (!from && !to) return items;
  return items.filter((item) => {
    const raw = getDate(item);
    const t = (typeof raw === "string" ? new Date(raw) : raw).getTime();
    if (!Number.isFinite(t)) return false;
    if (from && t < from.getTime()) return false;
    if (to && t > to.getTime()) return false;
    return true;
  });
}

export function channelBreakdown(dispatches: PromoDispatch[]): ChannelBreakdownRow[] {
  const counts = new Map<PromoChannelId, number>();
  for (const d of dispatches) {
    counts.set(d.channel, (counts.get(d.channel) ?? 0) + 1);
  }
  const total = dispatches.length || 1;
  const rows: ChannelBreakdownRow[] = [];
  for (const [channel, count] of counts) {
    rows.push({ channel, count, pct: count / total });
  }
  rows.sort((a, b) => b.count - a.count);
  return rows;
}

/**
 * Daily dispatch buckets (CTR sparkline proxy until clicks[] RPC).
 * Returns `days` rows ending at `now` (newest last).
 */
export function dailyDispatchBuckets(
  dispatches: PromoDispatch[],
  days: number,
  now: Date = new Date(),
): DailyBucket[] {
  const buckets: DailyBucket[] = [];
  const keys: string[] = [];
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    const k = ymdKey(d);
    keys.push(k);
    buckets.push({ ymd: k, count: 0 });
  }
  const idx = new Map(keys.map((k, i) => [k, i]));
  for (const d of dispatches) {
    const k = ymdKey(d.sentAt);
    const i = idx.get(k);
    if (typeof i === "number") buckets[i].count += 1;
  }
  return buckets;
}

export function topCampaignByDispatches(
  campaigns: PromoCampaign[],
  dispatches: PromoDispatch[],
): PromoCampaign | null {
  if (dispatches.length === 0 || campaigns.length === 0) return null;
  const counts = new Map<string, number>();
  for (const d of dispatches) {
    counts.set(d.campaignId, (counts.get(d.campaignId) ?? 0) + 1);
  }
  let bestId: string | null = null;
  let best = 0;
  for (const [id, n] of counts) {
    if (n > best) {
      best = n;
      bestId = id;
    }
  }
  if (!bestId) return null;
  return campaigns.find((c) => c.id === bestId) ?? null;
}

export function resolveCampaignTitle(
  campaigns: PromoCampaign[],
  id: string,
): string {
  return campaigns.find((c) => c.id === id)?.title ?? id;
}

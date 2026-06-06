import { describe, expect, it } from "vitest";
import {
  channelBreakdown,
  dailyClickBuckets,
  dailyDispatchBuckets,
  filterByPeriod,
  periodRange,
  resolveCampaignTitle,
  topCampaignByDispatches,
  topChannelFromClicks,
} from "../analyticsAggregate";
import type { PromoCampaign, PromoClick, PromoDispatch } from "@/features/admin/promo/types";

function disp(
  id: string,
  campaignId: string,
  channel: PromoDispatch["channel"],
  sentAt: string,
): PromoDispatch {
  return { id, campaignId, channel, variantId: "v", sentAt, status: "sent" };
}

function camp(id: string, title: string): PromoCampaign {
  return {
    id,
    title,
    brief: "",
    targetUrl: "",
    channels: [],
    variants: [],
    scheduledAt: new Date().toISOString(),
    status: "draft",
    riskScore: 0,
  };
}

describe("analyticsAggregate", () => {
  it("channelBreakdown counts + pct sums to ~1", () => {
    const rows = channelBreakdown([
      disp("1", "a", "telegram", "2026-06-01T00:00:00Z"),
      disp("2", "a", "telegram", "2026-06-01T00:00:00Z"),
      disp("3", "b", "x", "2026-06-01T00:00:00Z"),
    ]);
    expect(rows[0].channel).toBe("telegram");
    expect(rows[0].count).toBe(2);
    expect(rows[0].pct).toBeCloseTo(2 / 3, 5);
    const sum = rows.reduce((s, r) => s + r.pct, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("filterByPeriod uses from/to inclusive of range", () => {
    const items = [
      disp("1", "a", "telegram", "2026-06-01T00:00:00Z"),
      disp("2", "a", "telegram", "2026-06-05T00:00:00Z"),
      disp("3", "a", "telegram", "2026-06-10T00:00:00Z"),
    ];
    const out = filterByPeriod(
      items,
      (d) => d.sentAt,
      new Date("2026-06-03T00:00:00Z"),
      new Date("2026-06-08T00:00:00Z"),
    );
    expect(out.map((d) => d.id)).toEqual(["2"]);
  });

  it("periodRange returns null range for all", () => {
    expect(periodRange(new Date(), "all")).toEqual({ from: null, to: null });
    const r7 = periodRange(new Date("2026-06-10T00:00:00Z"), "7d");
    expect(r7.from?.toISOString()).toBe("2026-06-03T00:00:00.000Z");
  });

  it("dailyDispatchBuckets returns N buckets with counts assigned", () => {
    const now = new Date(2026, 5, 10);
    const items = [
      disp("1", "a", "telegram", new Date(2026, 5, 10, 9).toISOString()),
      disp("2", "a", "telegram", new Date(2026, 5, 10, 18).toISOString()),
      disp("3", "a", "x", new Date(2026, 5, 8, 12).toISOString()),
    ];
    const buckets = dailyDispatchBuckets(items, 7, now);
    expect(buckets).toHaveLength(7);
    expect(buckets[buckets.length - 1].count).toBe(2);
    expect(buckets[buckets.length - 3].count).toBe(1);
  });

  it("topCampaignByDispatches returns highest-count campaign", () => {
    const top = topCampaignByDispatches(
      [camp("a", "A"), camp("b", "B")],
      [
        disp("1", "a", "telegram", "2026-06-01T00:00:00Z"),
        disp("2", "b", "telegram", "2026-06-01T00:00:00Z"),
        disp("3", "b", "x", "2026-06-01T00:00:00Z"),
      ],
    );
    expect(top?.id).toBe("b");
  });

  it("resolveCampaignTitle falls back to id when not found", () => {
    expect(resolveCampaignTitle([camp("a", "Alpha")], "a")).toBe("Alpha");
    expect(resolveCampaignTitle([], "x")).toBe("x");
  });

  it("topCampaignByDispatches returns null for empty inputs", () => {
    expect(topCampaignByDispatches([], [])).toBeNull();
    expect(topCampaignByDispatches([camp("a", "A")], [])).toBeNull();
  });

  it("topChannelFromClicks returns highest-count channel", () => {
    const clicks: PromoClick[] = [
      { id: "1", campaignId: "a", channel: "telegram", ts: "2026-06-01T00:00:00Z" },
      { id: "2", campaignId: "a", channel: "telegram", ts: "2026-06-01T00:00:00Z" },
      { id: "3", campaignId: "b", channel: "x", ts: "2026-06-01T00:00:00Z" },
    ];
    expect(topChannelFromClicks(clicks)).toBe("telegram");
    expect(topChannelFromClicks([])).toBeNull();
  });

  it("dailyClickBuckets returns N buckets with counts assigned", () => {
    const now = new Date(2026, 5, 10);
    const clicks: PromoClick[] = [
      { id: "1", campaignId: "a", channel: "telegram", ts: new Date(2026, 5, 10, 9).toISOString() },
      { id: "2", campaignId: "a", channel: "x", ts: new Date(2026, 5, 10, 18).toISOString() },
      { id: "3", campaignId: "a", channel: "telegram", ts: new Date(2026, 5, 8, 12).toISOString() },
    ];
    const buckets = dailyClickBuckets(clicks, 7, now);
    expect(buckets).toHaveLength(7);
    expect(buckets[buckets.length - 1].count).toBe(2);
    expect(buckets[buckets.length - 3].count).toBe(1);
  });

  it("dailyClickBuckets returns all-zero for empty input", () => {
    const buckets = dailyClickBuckets([], 7, new Date(2026, 5, 10));
    expect(buckets).toHaveLength(7);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });
});

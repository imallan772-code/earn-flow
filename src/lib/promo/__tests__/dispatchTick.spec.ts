import { describe, expect, it } from "vitest";
import { planDispatch } from "@/lib/promo/dispatchTick";
import type { PromoCampaign } from "@/features/admin/promo/types";

const base: PromoCampaign = {
  id: "c1",
  title: "t",
  brief: "b",
  targetUrl: "https://x",
  channels: ["telegram", "slack"],
  variants: [
    { id: "v-tg", channel: "telegram", body: "t", hashtags: [], weight: 1 },
    { id: "v-sl", channel: "slack", body: "s", hashtags: [], weight: 1 },
  ],
  scheduledAt: new Date(Date.now() - 60_000).toISOString(),
  status: "scheduled",
  riskScore: 0,
};

describe("dispatchTick.planDispatch", () => {
  it("emits one item per (campaign, channel) for due scheduled campaigns", () => {
    const plan = planDispatch([base]);
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.channel).sort()).toEqual(["slack", "telegram"]);
  });

  it("ignores non-scheduled or future campaigns", () => {
    const draft = { ...base, id: "d1", status: "draft" as const };
    const future = {
      ...base,
      id: "f1",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    const plan = planDispatch([draft, future]);
    expect(plan).toHaveLength(0);
  });

  it("falls back to first variant when channel variant missing", () => {
    const c: PromoCampaign = { ...base, channels: ["x"], id: "c2" };
    const plan = planDispatch([c]);
    expect(plan).toHaveLength(1);
    expect(plan[0].variantId).toBe("v-tg");
  });
});

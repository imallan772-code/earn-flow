import { describe, expect, it, vi } from "vitest";
import { publishPromoChannel } from "@/lib/promo/dispatch.server";

describe("dispatch.server publishPromoChannel", () => {
  it("returns NO_VARIANT when campaign has no variants", async () => {
    const r = await publishPromoChannel(
      {
        id: "c1",
        title: "T",
        brief: "",
        targetUrl: "https://x.y",
        channels: ["telegram"],
        variants: [],
        scheduledAt: new Date().toISOString(),
        status: "scheduled",
        riskScore: 0,
      },
      "telegram",
      {},
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("NO_VARIANT");
  });

  it("calls recordDispatch on adapter result", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const r = await publishPromoChannel(
      {
        id: "c1",
        title: "T",
        brief: "",
        targetUrl: "https://x.y",
        channels: ["x"],
        variants: [{ id: "v1", channel: "x", body: "hi", hashtags: [], weight: 1 }],
        scheduledAt: new Date().toISOString(),
        status: "scheduled",
        riskScore: 0,
      },
      "x",
      {},
      record,
    );
    expect(r.ok).toBe(false);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: "c1", variantId: "v1", channel: "x", status: "failed" }),
    );
  });
});

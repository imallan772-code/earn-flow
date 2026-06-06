import { describe, expect, it, beforeEach } from "vitest";
import { promoMockStore } from "@/features/admin/promo/store/mockStore";

describe("mockStore", () => {
  beforeEach(() => promoMockStore.__reset());

  it("upsert + remove campaign", () => {
    promoMockStore.upsertCampaign({
      id: "c1",
      title: "T",
      brief: "B",
      targetUrl: "https://x.io",
      channels: ["telegram"],
      variants: [],
      scheduledAt: new Date().toISOString(),
      status: "draft",
      riskScore: 0,
    });
    expect(promoMockStore.getSnapshot().campaigns).toHaveLength(1);
    promoMockStore.removeCampaign("c1");
    expect(promoMockStore.getSnapshot().campaigns).toHaveLength(0);
  });

  it("schedule updates status", () => {
    promoMockStore.upsertCampaign({
      id: "c2",
      title: "T",
      brief: "",
      targetUrl: "https://x.io",
      channels: [],
      variants: [],
      scheduledAt: new Date().toISOString(),
      status: "draft",
      riskScore: 0,
    });
    promoMockStore.scheduleCampaign("c2", "2030-01-01T00:00:00.000Z");
    const c = promoMockStore.getSnapshot().campaigns.find((x) => x.id === "c2");
    expect(c?.status).toBe("scheduled");
    expect(c?.scheduledAt).toBe("2030-01-01T00:00:00.000Z");
  });

  it("settings merge", () => {
    promoMockStore.updateSettings({ webhookUrl: "https://hook" });
    expect(promoMockStore.getSnapshot().settings.webhookUrl).toBe("https://hook");
    expect(promoMockStore.getSnapshot().settings.defaultUtmSource).toBe("phonara-promo");
  });
});

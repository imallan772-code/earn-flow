import { describe, expect, it } from "vitest";
import { campaignToUpsertPayload } from "@/features/admin/promo/lib/mapCampaign";

describe("campaignToUpsertPayload", () => {
  it("maps variants with imagePrompt in utm", () => {
    const payload = campaignToUpsertPayload({
      id: "camp-1",
      title: "T",
      brief: "B",
      targetUrl: "https://phonara.app",
      channels: ["telegram"],
      variants: [
        {
          id: "v1",
          channel: "telegram",
          body: "hello",
          hashtags: ["#a"],
          cta: "go",
          weight: 1,
          imagePrompt: "neon hero",
        },
      ],
      scheduledAt: "2030-01-01T00:00:00.000Z",
      status: "draft",
      riskScore: 5,
    });
    expect(payload.variants?.[0]?.utm).toEqual({ imagePrompt: "neon hero" });
    expect(payload.target_url).toBe("https://phonara.app");
  });
});

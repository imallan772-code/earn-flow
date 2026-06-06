import { describe, expect, it } from "vitest";
import { getChannelAdapter } from "@/lib/promo/channels";

describe("publish role separation + adapters", () => {
  it("OAuth adapters return OAUTH_REQUIRED without tokens (x/linkedin)", async () => {
    for (const ch of ["x", "linkedin"] as const) {
      const a = getChannelAdapter(ch);
      const r = await a.send({
        channel: ch,
        variant: { id: "v", channel: ch, body: "t", hashtags: [], weight: 1 },
        targetUrl: "https://x.y",
        settings: {},
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("OAUTH_REQUIRED");
    }
  });

  it("tiktok send returns NOT_IMPLEMENTED (video API)", async () => {
    const a = getChannelAdapter("tiktok");
    const r = await a.send({
      channel: "tiktok",
      variant: { id: "v", channel: "tiktok", body: "t", hashtags: [], weight: 1 },
      targetUrl: "",
      settings: { tiktokAccessToken: "fake" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_IMPLEMENTED");
  });

  it("resend stub returns NOT_IMPLEMENTED", async () => {
    const a = getChannelAdapter("resend");
    const r = await a.send({
      channel: "resend",
      variant: { id: "v", channel: "resend", body: "t", hashtags: [], weight: 1 },
      targetUrl: "",
      settings: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_IMPLEMENTED");
  });

  it("webhook channels (zapier/discord/slack) reachable via registry", () => {
    for (const ch of ["zapier", "discord", "slack"] as const) {
      expect(getChannelAdapter(ch).id).toBe(ch);
    }
  });

  it("telegram adapter is the singleton telegram adapter", () => {
    expect(getChannelAdapter("telegram").id).toBe("telegram");
  });
});

import { describe, expect, it } from "vitest";
import { parseAiBundle, AiParseError } from "@/lib/promo/ai.server";
import { buildFallbackVariants } from "@/lib/promo/fallbackVariants";

describe("parseAiBundle", () => {
  const channels = ["telegram", "x", "slack", "discord", "linkedin"] as const;

  it("parses valid JSON with all 5 channels", () => {
    const raw = JSON.stringify({
      brief: "정제됨",
      variants: channels.map((c) => ({ channel: c, body: `${c} body`, hashtags: ["#a"] })),
      risk: { score: 30, flags: ["보장"] },
    });
    const r = parseAiBundle(raw, { brief: "in", channels: [...channels] });
    expect(r.variants).toHaveLength(5);
    expect(r.variants.map((v) => v.channel)).toEqual([...channels]);
    expect(r.risk.score).toBe(30);
  });

  it("patches missing channels via fallback", () => {
    const raw = JSON.stringify({
      variants: [{ channel: "telegram", body: "only tg", hashtags: [] }],
      risk: { score: 0, flags: [] },
    });
    const r = parseAiBundle(raw, { brief: "test brief", channels: [...channels] });
    expect(r.variants).toHaveLength(5);
    expect(r.variants[0].body).toBe("only tg");
    // missing channels should come from fallback
    expect(r.variants[1].channel).toBe("x");
    expect(r.variants[1].body).toContain("test brief");
  });

  it("strips markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify({
      variants: [{ channel: "telegram", body: "b", hashtags: [] }],
      risk: { score: 0, flags: [] },
    }) + "\n```";
    const r = parseAiBundle(raw, { brief: "x", channels: ["telegram"] });
    expect(r.variants[0].body).toBe("b");
  });

  it("throws AiParseError on invalid JSON", () => {
    expect(() => parseAiBundle("not json", { brief: "x", channels: ["telegram"] })).toThrow(
      AiParseError,
    );
  });

  it("ignores unknown channels", () => {
    const raw = JSON.stringify({
      variants: [
        { channel: "bogus", body: "x", hashtags: [] },
        { channel: "telegram", body: "tg", hashtags: [] },
      ],
      risk: { score: 0, flags: [] },
    });
    const r = parseAiBundle(raw, { brief: "x", channels: ["telegram"] });
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0].body).toBe("tg");
  });

  it("fallback reuse — buildFallbackVariants produces 1 variant per channel", () => {
    const fb = buildFallbackVariants("hello", [...channels]);
    expect(fb).toHaveLength(5);
    expect(fb[0].channel).toBe("telegram");
  });
});

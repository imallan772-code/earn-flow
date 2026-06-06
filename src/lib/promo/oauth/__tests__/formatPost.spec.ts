import { describe, expect, it } from "vitest";
import { formatXPostText } from "@/lib/promo/oauth/formatPost";

describe("formatXPostText", () => {
  it("truncates to 280 chars", () => {
    const long = "a".repeat(300);
    expect(formatXPostText({ id: "v", channel: "x", body: long, hashtags: [], weight: 1 }, "").length).toBeLessThanOrEqual(280);
  });

  it("includes target url", () => {
    const text = formatXPostText(
      { id: "v", channel: "x", body: "hello", hashtags: ["#promo"], weight: 1 },
      "https://example.com",
    );
    expect(text).toContain("hello");
    expect(text).toContain("#promo");
    expect(text).toContain("https://example.com");
  });
});

import { describe, expect, it } from "vitest";
import { mergeUtm } from "@/lib/promo/utm";
import { assertSafeUrl } from "@/lib/promo/ssrf";

describe("redirect (simulated)", () => {
  it("merges utm + slug campaign", () => {
    const safe = assertSafeUrl("https://phonara.app/land");
    const final = mergeUtm(safe.toString(), {
      utm_source: "phonara",
      utm_medium: "telegram",
      utm_campaign: "launch",
    });
    expect(final).toContain("utm_campaign=launch");
    expect(final).toContain("utm_medium=telegram");
  });
  it("rejects unsafe target via assertSafeUrl", () => {
    expect(() => assertSafeUrl("http://127.0.0.1")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { buildUtmUrl, mergeUtm } from "@/lib/promo/utm";

describe("utm", () => {
  it("builds utm params", () => {
    const u = buildUtmUrl("https://x.io/a", { source: "p", medium: "tg", campaign: "c1" });
    expect(u).toContain("utm_source=p");
    expect(u).toContain("utm_medium=tg");
    expect(u).toContain("utm_campaign=c1");
  });
  it("merge overrides existing", () => {
    const u = mergeUtm("https://x.io?utm_source=old", { utm_source: "new" });
    expect(u).toContain("utm_source=new");
    expect(u).not.toContain("utm_source=old");
  });
  it("preserves path", () => {
    const u = buildUtmUrl("https://x.io/foo/bar", { source: "s", medium: "m", campaign: "c" });
    expect(u).toContain("/foo/bar");
  });
});

import { describe, expect, it } from "vitest";
import { resolveModeFromSettings, isAnonymousUser } from "../resolveMode";

describe("resolveMode", () => {
  it("forces demo for anonymous users", () => {
    expect(resolveModeFromSettings({ is_anonymous: true }, { preferred_mode: "real" })).toBe(
      "demo",
    );
  });

  it("respects preferred_mode demo for registered users", () => {
    expect(resolveModeFromSettings({ is_anonymous: false }, { preferred_mode: "demo" })).toBe(
      "demo",
    );
  });

  it("defaults registered users to real", () => {
    expect(resolveModeFromSettings({ is_anonymous: false }, null)).toBe("real");
  });

  it("treats missing user as anonymous", () => {
    expect(isAnonymousUser(null)).toBe(true);
  });
});

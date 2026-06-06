import { describe, expect, it } from "vitest";
import { nextTickAt } from "@/lib/promo/schedule";

describe("schedule", () => {
  it("every 15m", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const n = nextTickAt("every 15m", from);
    expect(n?.toISOString()).toBe("2026-01-01T00:15:00.000Z");
  });
  it("daily next day if past", () => {
    const from = new Date("2026-01-01T10:00:00Z");
    const n = nextTickAt("daily 09:00", from);
    expect(n?.getUTCDate()).toBe(2);
  });
  it("returns null on garbage", () => {
    expect(nextTickAt("nope")).toBeNull();
  });
});

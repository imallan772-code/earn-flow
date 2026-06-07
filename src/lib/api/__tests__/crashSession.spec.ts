import { describe, expect, it } from "vitest";
import { multFromE6, multToE6 } from "../crashSession";

describe("crashSession e6 helpers", () => {
  it("round-trips multipliers", () => {
    expect(multFromE6(multToE6(2.47))).toBeCloseTo(2.47, 5);
  });

  it("1.00x baseline", () => {
    expect(multToE6(1)).toBe(1_000_000);
  });
});

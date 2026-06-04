import { describe, it, expect } from "vitest";
import { quantize6, reachedTarget, formatMultiplier, clamp, round } from "../clamp";

describe("clamp utils", () => {
  describe("quantize6", () => {
    it("truncates to 6 decimals", () => {
      expect(quantize6(1.23456789)).toBe(1.234567);
      expect(quantize6(2.0000005)).toBe(2.0);
    });
    it("is idempotent", () => {
      const v = quantize6(1.7654321);
      expect(quantize6(v)).toBe(v);
    });
  });

  describe("reachedTarget — 2.000000 auto cashout precision", () => {
    it("confirms exactly at target 2.0", () => {
      expect(reachedTarget(2.0, 2.0)).toBe(true);
    });
    it("does NOT confirm at 1.999999 (under target)", () => {
      expect(reachedTarget(1.999999, 2.0)).toBe(false);
    });
    it("confirms at 2.000001 (over target)", () => {
      expect(reachedTarget(2.000001, 2.0)).toBe(true);
    });
    it("absorbs sub-nanosecond float drift (2.0 - 1e-12)", () => {
      expect(reachedTarget(2.0 - 1e-12, 2.0)).toBe(true);
    });
    it("rejects clearly-below-target floats (2.0 - 1e-6)", () => {
      expect(reachedTarget(2.0 - 1e-6, 2.0)).toBe(false);
    });
  });

  describe("formatMultiplier", () => {
    it("always renders fixed digits", () => {
      expect(formatMultiplier(2)).toBe("2.00");
      expect(formatMultiplier(2.5, 4)).toBe("2.5000");
    });
  });

  describe("clamp + round", () => {
    it("clamps to bounds", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(11, 0, 10)).toBe(10);
    });
    it("rounds half-up", () => {
      expect(round(1.005, 2)).toBe(1.01);
      expect(round(1.004, 2)).toBe(1.0);
    });
  });
});

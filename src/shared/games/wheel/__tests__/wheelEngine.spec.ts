/**
 * WheelEngine spec — 6 cases (길이/RTP/결정성/경계/spin범위/lookup존재).
 */
import { describe, expect, it } from "vitest";
import {
  WHEEL_RISKS,
  WHEEL_RTP_TARGET,
  WHEEL_SEGMENT_OPTIONS,
  expectedMultiplier,
  getSegments,
  multiplierAt,
  spin,
  type WheelSegments,
} from "../WheelEngine";

const SEED = { serverSeed: "phonara-wheel-test-server", clientSeed: "player-001", nonce: 7 };

describe("WheelEngine", () => {
  it("each (risk, segments) table length equals segments", () => {
    for (const r of WHEEL_RISKS) {
      for (const s of WHEEL_SEGMENT_OPTIONS) {
        expect(getSegments(r, s).length).toBe(s);
      }
    }
  });

  it("average multiplier per table is within ±0.5% of RTP target (0.99)", () => {
    for (const r of WHEEL_RISKS) {
      for (const s of WHEEL_SEGMENT_OPTIONS) {
        const mean = expectedMultiplier(r, s);
        expect(mean).toBeGreaterThan(WHEEL_RTP_TARGET - 0.005);
        expect(mean).toBeLessThan(WHEEL_RTP_TARGET + 0.005);
      }
    }
  });

  it("spin is deterministic for same (serverSeed, clientSeed, nonce, segments)", async () => {
    const a = await spin(SEED, 20);
    const b = await spin(SEED, 20);
    expect(a).toBe(b);
  });

  it("multiplierAt clamps index to table bounds", () => {
    const r = "low" as const;
    const s: WheelSegments = 10;
    const last = getSegments(r, s).length - 1;
    expect(multiplierAt(r, s, -5)).toBe(getSegments(r, s)[0]);
    expect(multiplierAt(r, s, 999)).toBe(getSegments(r, s)[last]);
    expect(multiplierAt(r, s, 3.7)).toBe(getSegments(r, s)[3]);
  });

  it("spin result is within [0, segments) across many nonces", async () => {
    for (const s of WHEEL_SEGMENT_OPTIONS) {
      for (let n = 0; n < 60; n++) {
        const idx = await spin({ ...SEED, nonce: n }, s);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(s);
      }
    }
  });

  it("every (risk, segments) lookup exists and returns finite multipliers", () => {
    for (const r of WHEEL_RISKS) {
      for (const s of WHEEL_SEGMENT_OPTIONS) {
        const arr = getSegments(r, s);
        for (const m of arr) {
          expect(Number.isFinite(m)).toBe(true);
          expect(m).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

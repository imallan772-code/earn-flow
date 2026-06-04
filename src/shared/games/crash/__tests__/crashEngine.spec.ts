import { describe, expect, it } from "vitest";
import {
  GROWTH,
  computeCrashPoint,
  msForMultiplier,
  multiplierAt,
  multiplierAt6,
  shouldAutoCashout,
} from "../CrashEngine";
import { commitServerSeed, verifyRevealedSeed } from "../../engine/provablyFair";

const seeds = (n: number) => ({
  serverSeed: "server-seed-fixed-1234567890",
  clientSeed: "client-seed-fixed",
  nonce: n,
});

describe("CrashEngine — determinism", () => {
  it("same seeds → identical crashPoint over 100 nonces", async () => {
    for (let n = 0; n < 100; n++) {
      const a = await computeCrashPoint(seeds(n));
      const b = await computeCrashPoint(seeds(n));
      expect(a).toBe(b);
    }
  });

  it("commit/reveal hash roundtrips", async () => {
    const s = "server-seed-fixed-1234567890";
    const commit = await commitServerSeed(s);
    expect(await verifyRevealedSeed(s, commit)).toBe(true);
    expect(await verifyRevealedSeed(s + "X", commit)).toBe(false);
  });
});

describe("CrashEngine — invariants", () => {
  it("crashPoint >= 1.00 always (500 rounds)", async () => {
    for (let n = 0; n < 500; n++) {
      const cp = await computeCrashPoint(seeds(n));
      expect(cp).toBeGreaterThanOrEqual(1.0);
    }
  });

  it("multiplier curve never drops below 1.00", () => {
    for (let t = 0; t < 60000; t += 100) {
      expect(multiplierAt(t)).toBeGreaterThanOrEqual(1.0);
    }
  });

  it("GROWTH constant exposed", () => {
    expect(GROWTH).toBeGreaterThan(0);
  });
});

describe("CrashEngine — 2.000000x auto-cashout 0-frame guarantee", () => {
  it("exact frame catches 2.00 target across 1000 simulated rounds", async () => {
    const target = 2.0;
    const frameMs = 16;
    let caught = 0;
    let runs = 0;
    for (let n = 0; n < 1000; n++) {
      const cp = await computeCrashPoint(seeds(n));
      if (cp < target) continue;
      runs++;
      const targetMs = msForMultiplier(target);
      // Frame-walk past the target — confirm reachedTarget triggers
      for (let t = 0; t <= targetMs + frameMs; t += frameMs) {
        if (shouldAutoCashout(t, target)) {
          caught++;
          break;
        }
      }
    }
    expect(runs).toBeGreaterThan(0);
    expect(caught).toBe(runs);
  });

  it("multiplierAt6 quantized to 6 decimals", () => {
    const v = multiplierAt6(12345);
    expect(v).toBeLessThanOrEqual(Math.exp(GROWTH * 12345));
    expect(Math.floor(v * 1e6)).toBe(Math.round(v * 1e6));
  });
});

describe("CrashEngine — RTP ≈ 99% (cashout at 2.00 strategy)", () => {
  it("cashout-at-2x EV within [0.94, 1.04] over 2000 rounds", async () => {
    const target = 2.0;
    const N = 2000;
    let totalReturn = 0;
    for (let n = 0; n < N; n++) {
      const cp = await computeCrashPoint(seeds(n));
      totalReturn += cp >= target ? target : 0;
    }
    const ev = totalReturn / N;
    expect(ev).toBeGreaterThan(0.94);
    expect(ev).toBeLessThan(1.04);
  });
});

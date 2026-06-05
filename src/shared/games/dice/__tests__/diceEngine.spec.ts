import { describe, expect, it } from "vitest";
import { MAX_ROLL, computeRoll, isWin, payoutMultiplier, winChance } from "../DiceEngine";

const seeds = (n: number) => ({
  serverSeed: "dice-server-seed-fixed",
  clientSeed: "dice-client-seed",
  nonce: n,
});

describe("DiceEngine — determinism & invariants", () => {
  it("same seeds → identical roll over 100 nonces", async () => {
    for (let n = 0; n < 100; n++) {
      const a = await computeRoll(seeds(n));
      const b = await computeRoll(seeds(n));
      expect(a).toBe(b);
    }
  });

  it("roll ∈ [0, MAX_ROLL] for 1000 rounds", async () => {
    for (let n = 0; n < 1000; n++) {
      const r = await computeRoll(seeds(n));
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(MAX_ROLL);
    }
  });
});

describe("DiceEngine — house edge", () => {
  it("payout × winChance ≈ 99 across targets", () => {
    for (const t of [1, 10, 25, 50, 75, 90, 99]) {
      for (const mode of ["over", "under"] as const) {
        const wc = winChance(t, mode);
        const pm = payoutMultiplier(wc);
        expect(pm * wc).toBeCloseTo(99, 6);
      }
    }
  });

  it("over+under winChance sum equals 100 for same target", () => {
    for (const t of [1, 50, 99]) {
      const sum = winChance(t, "over") + winChance(t, "under");
      expect(sum).toBeCloseTo(100, 6);
    }
  });
});

describe("DiceEngine — RTP ≈ 99% (target=50 over)", () => {
  it("EV within [0.94, 1.04] over 2000 rounds", async () => {
    const target = 50;
    const mode = "over" as const;
    const pm = payoutMultiplier(winChance(target, mode));
    const N = 2000;
    let totalReturn = 0;
    for (let n = 0; n < N; n++) {
      const r = await computeRoll(seeds(n));
      totalReturn += isWin(r, target, mode) ? pm : 0;
    }
    const ev = totalReturn / N;
    expect(ev).toBeGreaterThan(0.94);
    expect(ev).toBeLessThan(1.04);
  });
});

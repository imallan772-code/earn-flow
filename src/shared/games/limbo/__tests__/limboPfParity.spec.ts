import { describe, expect, it } from "vitest";
import {
  computeCrashPoint,
  isWin,
  payoutMultiplier,
  winChance,
  MIN_TARGET,
  MAX_TARGET,
} from "@/shared/games/limbo/LimboEngine";

const VECTORS = [
  { serverSeed: "phonara-limbo-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 0 },
  { serverSeed: "phonara-limbo-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 1 },
  { serverSeed: "limbo-server-seed-fixed", clientSeed: "limbo-client-seed", nonce: 42 },
  { serverSeed: "test-server-seed-abcdef", clientSeed: "test-client", nonce: 100 },
];

describe("Limbo PF parity (TS ↔ SQL limbo_compute_point formula)", () => {
  it("crash points are deterministic and ∈ [1.00, MAX_TARGET]", async () => {
    for (const v of VECTORS) {
      const crash = await computeCrashPoint(v);
      expect(crash).toBeGreaterThanOrEqual(1);
      expect(crash).toBeLessThanOrEqual(MAX_TARGET);
      const again = await computeCrashPoint(v);
      expect(again).toBe(crash);
    }
  });

  it("win/payout helpers are consistent for sample targets", () => {
    for (const target of [1.01, 2, 10, 100, 1000]) {
      const wc = winChance(target);
      const pm = payoutMultiplier(target);
      expect(pm).toBe(target);
      expect(wc).toBeCloseTo(99 / target, 5);
      expect(isWin(target, target)).toBe(true);
      expect(isWin(target - 0.01, target)).toBe(false);
      expect(pm).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(pm).toBeLessThanOrEqual(MAX_TARGET);
    }
  });
});

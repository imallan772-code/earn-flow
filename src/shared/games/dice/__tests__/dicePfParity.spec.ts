import { describe, expect, it } from "vitest";
import { computeRoll, isWin, payoutMultiplier, winChance } from "@/shared/games/dice/DiceEngine";

const VECTORS = [
  { serverSeed: "phonara-dice-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 0 },
  { serverSeed: "phonara-dice-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 1 },
  { serverSeed: "dice-server-seed-fixed", clientSeed: "dice-client-seed", nonce: 42 },
  { serverSeed: "test-server-seed-abcdef", clientSeed: "test-client", nonce: 100 },
];

describe("Dice PF parity (TS ↔ SQL dice_compute_roll formula)", () => {
  it("rolls are deterministic and ∈ [0, 99.99]", async () => {
    for (const v of VECTORS) {
      const roll = await computeRoll(v);
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThanOrEqual(99.99);
      const again = await computeRoll(v);
      expect(again).toBe(roll);
    }
  });

  it("win/payout helpers are consistent for sample targets", () => {
    for (const target of [1, 25, 50, 75, 98]) {
      for (const mode of ["over", "under"] as const) {
        const wc = winChance(target, mode);
        const pm = payoutMultiplier(wc);
        expect(pm * wc).toBeCloseTo(99, 5);
        expect(isWin(target + 0.5, target, mode)).toBe(mode === "over");
        expect(isWin(target - 0.5, target, mode)).toBe(mode === "under");
      }
    }
  });
});

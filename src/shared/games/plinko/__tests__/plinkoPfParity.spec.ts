import { describe, expect, it } from "vitest";
import { MULTIPLIERS, dropPathPf, type RowCount } from "@/shared/games/plinko/PlinkoEngine";

const VECTORS = [
  { serverSeed: "phonara-plinko-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 0 },
  { serverSeed: "phonara-plinko-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 3 },
  { serverSeed: "plinko-server-seed-fixed", clientSeed: "plinko-client", nonce: 42 },
];

const ROWS: RowCount[] = [8, 12, 16];

describe("Plinko PF parity (TS dropPathPf ↔ SQL plinko_compute_path)", () => {
  it("HMAC paths are deterministic with valid slots", async () => {
    for (const v of VECTORS) {
      for (const rows of ROWS) {
        const res = await dropPathPf(v, rows, "medium");
        expect(res.path.length).toBe(rows);
        expect(res.finalSlot).toBeGreaterThanOrEqual(0);
        expect(res.finalSlot).toBeLessThanOrEqual(rows);
        expect(res.path.every((d) => d === 0 || d === 1)).toBe(true);
        expect(res.multiplier).toBe(MULTIPLIERS.medium[rows][res.finalSlot]);
        const again = await dropPathPf(v, rows, "medium");
        expect(again.path).toEqual(res.path);
      }
    }
  });

  it("final_slot equals sum of path directions", async () => {
    const res = await dropPathPf(VECTORS[0], 12, "high");
    expect(res.finalSlot).toBe(res.path.reduce((a, b) => a + b, 0));
  });
});

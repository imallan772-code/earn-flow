/**
 * MinesEngine spec — 6 cases (단조성·경계·PF 결정성·0-reveal·배치 유효성).
 */
import { describe, expect, it } from "vitest";
import {
  MAX_MINES,
  MIN_MINES,
  MINES_RTP,
  TOTAL_TILES,
  isMine,
  nextMultiplier,
  payoutGross,
  placeMines,
} from "../MinesEngine";

const PF = { serverSeed: "phonara-mines-test", clientSeed: "player-001", nonce: 42 };

describe("MinesEngine", () => {
  it("nextMultiplier is strictly monotonic in revealedSafe for any mineCount", () => {
    for (const m of [1, 3, 5, 10, 20, 24]) {
      const safeMax = TOTAL_TILES - m;
      let prev = nextMultiplier(0, m);
      for (let r = 1; r <= safeMax; r++) {
        const cur = nextMultiplier(r, m);
        expect(cur).toBeGreaterThan(prev);
        prev = cur;
      }
    }
  });

  it("mineCount=1 boundary: 24 safe reveals possible, first reveal multiplier matches formula", () => {
    const m = 1;
    expect(nextMultiplier(1, m)).toBeCloseTo(MINES_RTP * (25 / 24), 9);
    // last possible reveal still finite
    const last = nextMultiplier(TOTAL_TILES - m, m);
    expect(Number.isFinite(last)).toBe(true);
    expect(last).toBeGreaterThan(1);
  });

  it("mineCount=24 boundary: only 1 safe tile, first reveal yields RTP*25/1", () => {
    const m = MAX_MINES; // 24
    expect(nextMultiplier(1, m)).toBeCloseTo(MINES_RTP * 25, 9);
  });

  it("placeMines is deterministic for same input and returns mineCount unique indices in [0, 24]", async () => {
    const a = await placeMines(PF, 5);
    const b = await placeMines(PF, 5);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
    expect(new Set(a).size).toBe(5);
    for (const tile of a) {
      expect(tile).toBeGreaterThanOrEqual(0);
      expect(tile).toBeLessThan(TOTAL_TILES);
    }
    // sorted ascending
    expect([...a].sort((x, y) => x - y)).toEqual(a);
  });

  it("nextMultiplier(0, _) returns 1.0 (0-reveal protection) and payoutGross matches bet", () => {
    for (const m of [MIN_MINES, 3, 12, MAX_MINES]) {
      expect(nextMultiplier(0, m)).toBe(1.0);
      expect(payoutGross(50, 0, m)).toBe(50);
    }
  });

  it("isMine + hit handling: mine tiles are detected, safe tiles are not", async () => {
    const mines = await placeMines(PF, 7);
    expect(mines).toHaveLength(7);
    for (const tile of mines) {
      expect(isMine(tile, mines)).toBe(true);
    }
    for (let i = 0; i < TOTAL_TILES; i++) {
      if (!mines.includes(i)) expect(isMine(i, mines)).toBe(false);
    }
  });
});

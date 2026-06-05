import { describe, it, expect, beforeEach } from "vitest";
import { getSessionStats, recordSessionOutcome, resetSessionStats } from "../sessionStats";

describe("sessionStats", () => {
  beforeEach(() => resetSessionStats());

  it("accumulates pnl and streaks", () => {
    recordSessionOutcome({ outcome: "win", profit: 5, multiplier: 2 });
    recordSessionOutcome({ outcome: "win", profit: 3, multiplier: 1.5 });
    recordSessionOutcome({ outcome: "loss", profit: -10, multiplier: 0 });
    const s = getSessionStats();
    expect(s.pnl).toBe(-2);
    expect(s.winStreak).toBe(0);
    expect(s.lossStreak).toBe(1);
    expect(s.bestMultiplier).toBe(2);
    expect(s.rounds).toBe(3);
  });
});

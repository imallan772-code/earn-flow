import { describe, expect, it } from "vitest";
import { canClaimMission, isMissionClaimed, missionProgressPct } from "../progress";

describe("mission progress", () => {
  it("computes pct capped at 100", () => {
    expect(missionProgressPct({ progress: 4, total: 10 })).toBe(40);
    expect(missionProgressPct({ progress: 12, total: 10 })).toBe(100);
  });

  it("detects claimable missions", () => {
    expect(canClaimMission({ progress: 3, total: 3, claimed_at: null })).toBe(true);
    expect(canClaimMission({ progress: 2, total: 3, claimed_at: null })).toBe(false);
    expect(canClaimMission({ progress: 3, total: 3, claimed_at: "2026-01-01" })).toBe(false);
  });

  it("detects claimed state", () => {
    expect(isMissionClaimed({ claimed_at: null })).toBe(false);
    expect(isMissionClaimed({ claimed_at: "x" })).toBe(true);
  });
});

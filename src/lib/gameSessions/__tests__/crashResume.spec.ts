import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveCrashRound } from "@/shared/games/state/persistedGameState";

const crashSync = vi.fn();
const crashEnsureRunning = vi.fn();

vi.mock("@/lib/api/crashSession", () => ({
  crashSync: (...args: unknown[]) => crashSync(...args),
  crashEnsureRunning: (...args: unknown[]) => crashEnsureRunning(...args),
  multFromE6: (e6: number) => e6 / 1_000_000,
}));

import { resolveServerCrashResume } from "@/lib/gameSessions/crashResume";

const baseRound: ActiveCrashRound = {
  nonce: 7,
  amount: 10,
  autoTarget: 2,
  cashedAt: null,
  liveBetId: "lb_test",
  placedAt: Date.now(),
  crashPoint: Number.POSITIVE_INFINITY,
  startedAt: 0,
  bettingStartedAt: 0,
  betMode: "demo",
  serverSide: true,
};

describe("resolveServerCrashResume", () => {
  beforeEach(() => {
    crashSync.mockReset();
    crashEnsureRunning.mockReset();
  });

  it("maps busted sync to crashed phase with crash point", async () => {
    crashSync.mockResolvedValue({ status: "busted", crash_point_e6: 2_500_000 });
    const res = await resolveServerCrashResume(baseRound);
    expect(res.phase).toBe("crashed");
    expect(res.crashPoint).toBeCloseTo(2.5, 2);
  });

  it("maps idle sync to idle phase", async () => {
    crashSync.mockResolvedValue({ status: "idle" });
    const res = await resolveServerCrashResume(baseRound);
    expect(res.phase).toBe("idle");
  });

  it("arms running clock when startedAt missing", async () => {
    crashSync.mockResolvedValue({ status: "running" });
    crashEnsureRunning.mockResolvedValue(1_700_000_000_000);
    const res = await resolveServerCrashResume(baseRound);
    expect(res.phase).toBe("running");
    expect(res.startedAtMs).toBe(1_700_000_000_000);
    expect(crashEnsureRunning).toHaveBeenCalledWith("n7");
  });

  it("returns idle when ensureRunning finds no session", async () => {
    crashSync.mockResolvedValue({ status: "running" });
    crashEnsureRunning.mockResolvedValue(null);
    const res = await resolveServerCrashResume(baseRound);
    expect(res.phase).toBe("idle");
  });
});

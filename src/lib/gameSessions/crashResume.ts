import { crashStartRunning, crashSync, multFromE6 } from "@/lib/api/crashSession";
import type { ActiveCrashRound } from "@/shared/games/state/persistedGameState";

export type CrashResumePhase = "betting" | "running" | "crashed" | "idle";

export interface CrashResumeState {
  phase: CrashResumePhase;
  startedAtMs: number;
  crashPoint: number;
  cashedAtE6?: number;
}

/**
 * GA-E §5.1 — server SSOT resume after refresh/navigation.
 * Maps crash_sync_v1 status → client phase without revealing crash point early.
 */
export async function resolveServerCrashResume(ar: ActiveCrashRound): Promise<CrashResumeState> {
  const roundId = `n${ar.nonce}`;
  const sync = await crashSync(roundId);

  if (sync.status === "idle") {
    return { phase: "idle", startedAtMs: 0, crashPoint: ar.crashPoint };
  }

  if (sync.status === "cashed") {
    return {
      phase: "idle",
      startedAtMs: ar.startedAt,
      crashPoint: ar.crashPoint,
    };
  }

  if (sync.status === "busted" && sync.crash_point_e6 != null) {
    return {
      phase: "crashed",
      startedAtMs: ar.startedAt,
      crashPoint: multFromE6(sync.crash_point_e6),
    };
  }

  if (sync.status === "running") {
    let startedAtMs = ar.startedAt;
    if (startedAtMs <= 0) {
      const start = await crashStartRunning(roundId);
      startedAtMs = start.started_at_ms;
    }
    return {
      phase: "running",
      startedAtMs,
      crashPoint: Number.POSITIVE_INFINITY,
    };
  }

  // betting — clock not armed yet
  return {
    phase: "betting",
    startedAtMs: 0,
    crashPoint: Number.POSITIVE_INFINITY,
  };
}

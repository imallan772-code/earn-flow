import type { GameSessionRow } from "@/lib/gameSessions/schemas";
import { multFromE6 } from "@/lib/api/crashSession";
import { nonceFromRoundId } from "@/shared/games/gameSessionHelpers";
import type { ActiveCrashRound } from "@/shared/games/state/persistedGameState";

export function activeCrashRoundFromSession(
  row: GameSessionRow,
  fallback: { autoTarget: number; liveBetId?: string },
): ActiveCrashRound {
  const cs = row.client_state;
  const nonce = typeof cs.nonce === "number" ? cs.nonce : nonceFromRoundId(row.round_id);
  const stake =
    typeof cs.stake_amount === "number"
      ? cs.stake_amount
      : row.bet_amount > 0
        ? row.bet_amount
        : 0;
  const autoTargetE6 = typeof cs.auto_target_e6 === "number" ? cs.auto_target_e6 : null;
  const cashedAtE6 = typeof cs.cashed_at_e6 === "number" ? cs.cashed_at_e6 : null;
  const startedAtMs =
    typeof cs.started_at_ms === "number" && cs.started_at_ms > 0 ? cs.started_at_ms : 0;
  const betMode = cs.bet_mode === "demo" ? "demo" : "real";

  return {
    nonce,
    amount: stake,
    autoTarget: autoTargetE6 != null ? multFromE6(autoTargetE6) : fallback.autoTarget,
    cashedAt: cashedAtE6 != null ? multFromE6(cashedAtE6) : null,
    liveBetId: fallback.liveBetId ?? `lb_crash_${row.round_id}`,
    placedAt: typeof cs.placed_at === "number" ? cs.placed_at : Date.now(),
    crashPoint: Number.POSITIVE_INFINITY,
    startedAt: startedAtMs,
    bettingStartedAt: typeof cs.betting_started_at === "number" ? cs.betting_started_at : 0,
    betMode,
    serverSide: true,
  };
}

export function isCrashSessionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string; status?: number };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return (
    e.code === "42501" ||
    e.status === 409 ||
    msg.includes("CRASH_ACTIVE_SESSION") ||
    msg.includes("duplicate key")
  );
}

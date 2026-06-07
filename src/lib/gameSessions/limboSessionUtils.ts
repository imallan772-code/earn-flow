import type { GameSessionRow } from "@/lib/gameSessions/schemas";
import { nonceFromRoundId } from "@/shared/games/gameSessionHelpers";
import type { ActiveLimboRound } from "@/shared/games/state/persistedGameState";

export function activeLimboRoundFromSession(
  row: GameSessionRow,
  fallback: { liveBetId?: string },
): ActiveLimboRound {
  const cs = row.client_state;
  const nonce = typeof cs.nonce === "number" ? cs.nonce : nonceFromRoundId(row.round_id);
  const stake =
    typeof cs.stake_amount === "number"
      ? cs.stake_amount
      : row.bet_amount > 0
        ? row.bet_amount
        : 0;

  return {
    nonce,
    amount: stake,
    target: typeof cs.target === "number" ? cs.target : 2,
    liveBetId: fallback.liveBetId ?? `lb_limbo_${row.round_id}`,
    placedAt: typeof cs.placed_at === "number" ? cs.placed_at : Date.now(),
    betMode: cs.bet_mode === "demo" ? "demo" : "real",
    serverSide: true,
    crashPoint: typeof cs.crash_point === "number" ? cs.crash_point : undefined,
    won: typeof cs.won === "boolean" ? cs.won : undefined,
    payoutMultiplier:
      typeof cs.payout_multiplier === "number" ? cs.payout_multiplier : undefined,
    nextNonce: typeof cs.next_nonce === "number" ? cs.next_nonce : undefined,
  };
}

export function isLimboSessionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string; status?: number };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return (
    e.code === "42501" ||
    e.status === 409 ||
    msg.includes("LIMBO_ACTIVE_SESSION") ||
    msg.includes("duplicate key")
  );
}

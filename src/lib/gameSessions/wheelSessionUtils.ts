import type { GameSessionRow } from "@/lib/gameSessions/schemas";
import { nonceFromRoundId } from "@/shared/games/gameSessionHelpers";
import type { ActiveWheelRound } from "@/shared/games/state/persistedGameState";
import type { WheelRisk, WheelSegments } from "@/shared/games/wheel/WheelEngine";

function parseRisk(value: unknown): WheelRisk {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function parseSegments(value: unknown): WheelSegments {
  if (value === 10 || value === 20 || value === 30) return value;
  return 20;
}

export function activeWheelRoundFromSession(
  row: GameSessionRow,
  fallback: { liveBetId?: string },
): ActiveWheelRound {
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
    risk: parseRisk(cs.risk),
    segments: parseSegments(cs.segments),
    liveBetId: fallback.liveBetId ?? `lb_wheel_${row.round_id}`,
    placedAt: typeof cs.placed_at === "number" ? cs.placed_at : Date.now(),
    betMode: cs.bet_mode === "demo" ? "demo" : "real",
    serverSide: true,
    spinIndex: typeof cs.spin_index === "number" ? cs.spin_index : undefined,
    multiplier: typeof cs.multiplier === "number" ? cs.multiplier : undefined,
    won: typeof cs.won === "boolean" ? cs.won : undefined,
    nextNonce: typeof cs.next_nonce === "number" ? cs.next_nonce : undefined,
  };
}

export function isWheelSessionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string; status?: number };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return (
    e.code === "42501" ||
    e.status === 409 ||
    msg.includes("WHEEL_ACTIVE_SESSION") ||
    msg.includes("duplicate key")
  );
}

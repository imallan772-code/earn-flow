import type { GameSessionRow } from "@/lib/gameSessions/schemas";
import type { ActiveMinesRound } from "@/shared/games/state/persistedGameState";
import { nonceFromRoundId } from "@/shared/games/gameSessionHelpers";

/** Postgres jsonb `revealed` → number[] (Supabase JSON shapes vary). */
export function normalizeRevealedTiles(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((t) => Number(t)).filter((t) => Number.isFinite(t));
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => Number(t)).filter((t) => Number.isFinite(t));
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function activeMinesRoundFromSession(
  row: GameSessionRow,
  fallbackMineCount: number,
  localLiveBetId?: string,
): ActiveMinesRound {
  const cs = row.client_state;
  const mineCount = typeof cs.mine_count === "number" ? cs.mine_count : fallbackMineCount;
  const nonce = typeof cs.nonce === "number" ? cs.nonce : nonceFromRoundId(row.round_id);
  return {
    nonce,
    amount: row.bet_amount,
    mineCount,
    mines: [],
    revealed: normalizeRevealedTiles(cs.revealed),
    liveBetId: localLiveBetId ?? `lb_mines_${row.round_id}`,
    placedAt: typeof cs.placed_at === "number" ? cs.placed_at : Date.now(),
    betMode: "real",
    serverSide: true,
  };
}

export function isMinesSessionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string; status?: number };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return (
    e.code === "P0002" ||
    e.code === "23505" ||
    e.status === 409 ||
    msg.includes("MINES_SESSION_ACTIVE") ||
    msg.includes("MONEY_IDEMPOTENCY_CONFLICT") ||
    msg.includes("duplicate key") ||
    msg.includes("409")
  );
}

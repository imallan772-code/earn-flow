/**
 * Real-mode active session helpers — Stake-like resume SSOT (cross-device).
 */
import {
  clearGameActiveSession,
  getGameActiveSession,
  syncGameActiveSession,
} from "@/lib/api/gameSessions";
import type { GameSessionRow } from "@/lib/gameSessions/schemas";

export function syncRealSession(
  game: string,
  roundId: string,
  betAmount: number,
  clientState: Record<string, unknown>,
): void {
  void syncGameActiveSession(game, roundId, betAmount, clientState).catch(() => undefined);
}

export function clearRealSession(game: string, roundId: string): void {
  void clearGameActiveSession(game, roundId).catch(() => undefined);
}

export async function fetchRealSession(game: string): Promise<GameSessionRow | null> {
  try {
    return await getGameActiveSession(game);
  } catch {
    return null;
  }
}

export function nonceFromRoundId(roundId: string): number {
  const n = Number(roundId.replace(/^n/, ""));
  return Number.isFinite(n) ? n : 0;
}

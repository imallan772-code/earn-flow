/**
 * Real-mode active session helpers — Stake-like resume SSOT (cross-device).
 *
 * Resume-First anti-abuse policy: @see resumePolicy.ts (GA-0 — no unmount refund).
 */
export { RESUME_FIRST_POLICY, GA0_PR_CHECKLIST } from "./resumePolicy";
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

/**
 * House edge / RTP helper — pure.
 *
 * Used by display + settlement code in all games. Engine determinism
 * (computeRoll, computeCrashPoint) is never touched.
 *
 *   demo → 1.00 (no edge, friendly)
 *   real → 0.97 (3% house edge)
 */
import { RTP, type GameMode } from "@/shared/mode/ModeContext";

export { RTP };
export type { GameMode };

/** Apply mode RTP to a raw payout multiplier. */
export function applyEdge(rawMultiplier: number, mode: GameMode): number {
  return rawMultiplier * RTP[mode];
}

/** Compute net profit for a given bet, cash-out multiplier and mode. */
export function profitOf(bet: number, multiplier: number, mode: GameMode): number {
  return bet * (applyEdge(multiplier, mode) - 1);
}

/** Compute gross payout (return on bet + bet) given bet/mult/mode. */
export function payoutOf(bet: number, multiplier: number, mode: GameMode): number {
  return bet * applyEdge(multiplier, mode);
}

/**
 * Wallet-ready gross payout — real mode rounds to nearest integer PHON (Stake-like).
 * Demo keeps full float precision for sub-PHON stakes.
 */
export function settlementPayout(bet: number, multiplier: number, mode: GameMode): number {
  const raw = payoutOf(bet, multiplier, mode);
  return mode === "real" ? Math.round(raw) : raw;
}

/** Net profit after settlement rounding — matches credited payout − stake. */
export function settlementProfit(bet: number, multiplier: number, mode: GameMode): number {
  return settlementPayout(bet, multiplier, mode) - bet;
}

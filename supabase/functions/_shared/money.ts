/**
 * Payout SSOT — mirrors src/shared/games/engine/houseEdge.ts settlementPayout.
 * W1~W3: integer PHON rounding for real mode; demo keeps float precision.
 */

export type GameMode = "demo" | "real";

const RTP: Record<GameMode, number> = {
  demo: 1.0,
  real: 1.0,
};

export function applyEdge(rawMultiplier: number, mode: GameMode): number {
  return rawMultiplier * RTP[mode];
}

export function payoutOf(bet: number, multiplier: number, mode: GameMode): number {
  return bet * applyEdge(multiplier, mode);
}

/** Wallet-ready gross payout — real mode rounds to nearest integer PHON. */
export function computePayout(bet: number, multiplier: number, mode: GameMode): number {
  const raw = payoutOf(bet, multiplier, mode);
  return mode === "real" ? Math.round(raw) : raw;
}

export function computeProfit(bet: number, multiplier: number, mode: GameMode): number {
  return computePayout(bet, multiplier, mode) - bet;
}

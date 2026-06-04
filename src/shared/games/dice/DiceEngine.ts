/**
 * DiceEngine — pure deterministic logic (no React, no DOM).
 *
 * Stake.com Dice 1:1 — 1% house edge.
 *
 *   roll ∈ [0.00, 99.99]   (derived from HMAC-SHA256)
 *   target ∈ [0.01, 99.98]
 *   mode = "over" | "under"
 *   winChance(target, mode) yields % chance to win
 *   payout = 99 / winChance(%)        →   RTP = 99%
 */

import { bytesGenerator, floatFromBytes, type ProvablyFairInput } from "../engine/provablyFair";

export type DiceMode = "over" | "under";

export const MAX_ROLL = 99.99;

/** Compute the deterministic roll ∈ [0.00, MAX_ROLL]. */
export async function computeRoll(input: ProvablyFairInput): Promise<number> {
  const bytes = await bytesGenerator(input, 0);
  const f = floatFromBytes(bytes, 0);
  return Math.floor(f * (MAX_ROLL + 0.01) * 100) / 100;
}

/** Win probability as a percentage (0..100). */
export function winChance(target: number, mode: DiceMode): number {
  const t = clamp01(target);
  return mode === "over" ? ((MAX_ROLL - t) / (MAX_ROLL + 0.01)) * 100 : ((t + 0.01) / (MAX_ROLL + 0.01)) * 100;
}

/** Payout multiplier (1% house edge). */
export function payoutMultiplier(chancePct: number): number {
  if (chancePct <= 0) return 0;
  return 99 / chancePct;
}

/** Pure win check. */
export function isWin(roll: number, target: number, mode: DiceMode): boolean {
  return mode === "over" ? roll > target : roll < target;
}

function clamp01(target: number): number {
  return Math.max(0.01, Math.min(MAX_ROLL - 0.01, target));
}

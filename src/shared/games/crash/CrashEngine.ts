/**
 * CrashEngine — pure deterministic logic (no React, no DOM).
 *
 * Round lifecycle:
 *   betting (5s)  → running  → crashed  → cooldown (3s)  → next round
 *
 * Multiplier curve (Stake-compatible):
 *   m(t) = max(1.00, floor( exp(GROWTH * t_ms) * 100 ) / 100 )
 *   GROWTH ≈ 0.00006  → ~2.00x at ~11.5s, ~10x at ~38s
 *
 * Provably-fair crash point:
 *   bytes = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}:0`)
 *   h     = uint32 from first 4 bytes
 *   if h % 100 === 0 → instant bust (1.00x) — gives ~1% house edge
 *   else crashPoint = floor((100 * 2^32 - h) / (2^32 - h)) / 100
 */

import { bytesGenerator, type ProvablyFairInput } from "../engine/provablyFair";
import { quantize6, reachedTarget } from "../engine/clamp";

export const GROWTH = 0.00006;
export const BETTING_MS = 5000;
export const COOLDOWN_MS = 3000;

export type Phase = "betting" | "running" | "crashed" | "cooldown";

export interface RoundState {
  phase: Phase;
  startedAt: number;
  elapsedMs: number;
  multiplier: number;
  crashPoint: number;
}

/** Instantaneous multiplier curve. Display precision = 2 decimals. */
export function multiplierAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return 1.0;
  const raw = Math.exp(GROWTH * elapsedMs);
  return Math.max(1.0, Math.floor(raw * 100) / 100);
}

/** High-precision multiplier (6 decimals) — used for auto-cashout comparisons. */
export function multiplierAt6(elapsedMs: number): number {
  if (elapsedMs <= 0) return 1.0;
  const raw = Math.exp(GROWTH * elapsedMs);
  return Math.max(1.0, quantize6(raw));
}

/** Inverse: ms at which the curve first reaches `target`. */
export function msForMultiplier(target: number): number {
  if (target <= 1) return 0;
  return Math.log(target) / GROWTH;
}

/** Determine whether `autoTarget` would have triggered by the given elapsed ms. */
export function shouldAutoCashout(elapsedMs: number, autoTarget: number): boolean {
  return reachedTarget(multiplierAt6(elapsedMs), autoTarget);
}

/**
 * Provably-fair crash point in [1.00, ∞).
 * 1% of rounds are instant 1.00 bust (house edge).
 */
export async function computeCrashPoint(input: ProvablyFairInput): Promise<number> {
  const bytes = await bytesGenerator(input, 0);
  const h =
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  if (h % 100 === 0) return 1.0;
  const max = 2 ** 32;
  const cp = Math.floor((100 * max - h) / (max - h)) / 100;
  return Math.max(1.0, cp);
}

/** Build initial state for a fresh round (still in betting phase). */
export function initRound(crashPoint: number): RoundState {
  return {
    phase: "betting",
    startedAt: 0,
    elapsedMs: 0,
    multiplier: 1.0,
    crashPoint,
  };
}

/** Pure tick — given current state and elapsed since round-start, return next. */
export function tick(state: RoundState, elapsedSinceStart: number): RoundState {
  if (state.phase === "betting" || state.phase === "cooldown") return state;
  const m = multiplierAt(elapsedSinceStart);
  if (m >= state.crashPoint) {
    return {
      ...state,
      elapsedMs: msForMultiplier(state.crashPoint),
      multiplier: state.crashPoint,
      phase: "crashed",
    };
  }
  return { ...state, elapsedMs: elapsedSinceStart, multiplier: m };
}

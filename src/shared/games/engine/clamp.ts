/**
 * Numeric guard utils — 0-frame auto-trigger precision.
 *
 * The whole point: when a user sets "Auto cashout at 2.00", the engine MUST
 * confirm at exactly 2.000000 — not 1.999999, not 2.000001 the next frame.
 */

/** Truncate to 6 decimal places. Stake.com display/comparison precision. */
export function quantize6(v: number): number {
  return Math.floor(v * 1e6) / 1e6;
}

/** Round-half-up to N decimals (for display only — never for comparison). */
export function round(v: number, digits = 2): number {
  const k = Math.pow(10, digits);
  // Pre-bias by EPSILON*v to absorb representation errors like 1.005 → 1.00499999...
  return Math.round(v * k * (1 + Number.EPSILON)) / k;
}

/**
 * Target-reached check with epsilon. Use for auto-cashout / take-profit.
 * `actual >= target - 1e-9` so that a frame-perfect 2.0 confirms at 2.0.
 */
export function reachedTarget(actual: number, target: number): boolean {
  return actual + 1e-9 >= target;
}

/** Format multiplier for UI (always digits decimals, no trailing zeros stripped). */
export function formatMultiplier(v: number, digits = 2): string {
  return v.toFixed(digits);
}

/** Clamp to [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

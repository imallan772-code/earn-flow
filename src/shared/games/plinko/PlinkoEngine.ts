/**
 * PlinkoEngine — pure deterministic Plinko core (Provably Fair + visual physics).
 *
 * Responsibilities:
 *   1. `dropPath(seed, rows, risk)` — authoritative outcome.
 *      Same (seed, rows, risk) → identical path / slot / multiplier forever.
 *   2. `simulatePhysics(result, onUpdate)` — visual-only simulation.
 *      Emits normalized (x, y, vy) samples for a Renderer to consume via rAF.
 *      The outcome is fixed by `dropPath`; physics just animates toward it.
 *
 * Purity contract:
 *   - No React, no DOM, no setTimeout/setInterval, no console, no I/O.
 *   - Zero imports. Safe to lift into a Web Worker as-is.
 *
 * Provably Fair:
 *   - `hashSeed` is FNV-1a 32-bit, identical to the project's
 *     `hashStringToSeed` so seeds stay compatible across modules.
 *   - Mulberry32 PRNG produces `rows` independent [0,1) draws;
 *     draw < 0.5 → left (0), else right (1). Slot probability follows the
 *     Pascal (binomial) distribution — risk is encoded by the payout table,
 *     not by biasing left/right probability.
 *
 * TODO (Real money mode):
 *   - Move `dropPath` to a Supabase Edge Function RPC (server is authoritative).
 *     Keep this engine client-side only for instant UX preview / replay.
 *   - On boot, validate the local MULTIPLIERS table against the server's
 *     canonical payout table; refuse to settle on mismatch.
 *   - Persist per-bet `{ seed, rows, risk, path, finalSlot, multiplier }` as a
 *     server-side audit record for provably-fair verification.
 */

export type RiskLevel = "low" | "medium" | "high";

export interface PlinkoDropResult {
  /** Per-row direction: 0 = left, 1 = right. Length === totalRows. */
  path: number[];
  /** Slot index in [0, totalRows]. Equals the count of 1s in `path`. */
  finalSlot: number;
  /** Payout multiplier from MULTIPLIERS[risk][rows][finalSlot]. */
  multiplier: number;
  /** 8 | 12 | 16. */
  totalRows: number;
  risk: RiskLevel;
  /** Echo of the input seed (for audit / replay). */
  seed: string;
}

/** Allowed row counts. Other values throw. */
const ALLOWED_ROWS = [8, 12, 16] as const;
type AllowedRows = (typeof ALLOWED_ROWS)[number];

/**
 * Stake.com-compatible payout tables. Symmetric, length = rows + 1.
 * Risk is encoded by the payout curve only; left/right probability stays
 * 50/50 so slot probability follows the Pascal distribution.
 *
 * TODO (Real money mode): treat server-provided table as source of truth.
 */
const MULTIPLIERS: Record<RiskLevel, Record<AllowedRows, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [76, 18, 6, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 6, 18, 76],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

/** Physics constants (normalized coordinate space: 0..1 for both axes). */
const GRAVITY = 0.0009;
const BOUNCE = 0.45;
const FRICTION = 0.985;
const PEG_NUDGE = 0.012;
const STEP_MS = 16; // logical step granularity; consumer drives the visual cadence
const MAX_STEPS = 4000;

export class PlinkoEngine {
  /**
   * Provably-fair authoritative outcome for one ball drop.
   * Pure: no side effects, no time dependency.
   */
  public dropPath(seed: string, rows: number, risk: RiskLevel = "medium"): PlinkoDropResult {
    if (!ALLOWED_ROWS.includes(rows as AllowedRows)) {
      throw new Error(
        `PlinkoEngine: rows must be one of ${ALLOWED_ROWS.join(", ")} (got ${rows})`,
      );
    }
    if (risk !== "low" && risk !== "medium" && risk !== "high") {
      throw new Error(`PlinkoEngine: invalid risk "${risk}"`);
    }
    if (typeof seed !== "string" || seed.length === 0) {
      throw new Error("PlinkoEngine: seed must be a non-empty string");
    }

    const totalRows = rows as AllowedRows;
    const rand = mulberry32(hashSeed(seed));
    const path: number[] = new Array(totalRows);
    let finalSlot = 0;
    for (let i = 0; i < totalRows; i++) {
      const dir = rand() < 0.5 ? 0 : 1;
      path[i] = dir;
      finalSlot += dir;
    }

    const multiplier = MULTIPLIERS[risk][totalRows][finalSlot];

    return { path, finalSlot, multiplier, totalRows, risk, seed };
  }

  /**
   * FNV-1a 32-bit hash. Exposed for callers that want the same seed→uint32
   * mapping used internally (matches the project's `hashStringToSeed`).
   */
  public hashSeed(input: string): number {
    return hashSeed(input);
  }

  /**
   * Visual-only physics. Deterministic but NOT authoritative.
   *
   * Emits normalized samples (x ∈ [0,1], y ∈ [0,1], vy) to `onUpdate`.
   * On each peg-row crossing the ball is nudged left/right per
   * `result.path[row]`, so it always lands in the slot fixed by `dropPath`.
   *
   * The caller drives the actual visual cadence (e.g. via requestAnimationFrame)
   * by consuming emitted samples in order. STEP_MS is a logical hint only.
   */
  public simulatePhysics(
    result: PlinkoDropResult,
    onUpdate: (x: number, y: number, velocityY: number) => void,
  ): void {
    const rows = result.totalRows;
    const rowGap = 1 / (rows + 1);

    let x = 0.5;
    let y = 0;
    let vx = 0;
    let vy = 0;

    let nextRow = 0;
    let steps = 0;

    while (steps < MAX_STEPS) {
      // Integrate
      vy += GRAVITY * STEP_MS;
      vy *= FRICTION;
      vx *= FRICTION;
      x += vx;
      y += vy;

      // Keep ball inside the board horizontally
      if (x < 0) {
        x = 0;
        vx = -vx * BOUNCE;
      } else if (x > 1) {
        x = 1;
        vx = -vx * BOUNCE;
      }

      // Peg interaction: when crossing the next peg row, apply the deterministic nudge
      const rowY = (nextRow + 1) * rowGap;
      if (nextRow < rows && y >= rowY) {
        const dir = result.path[nextRow];
        vx += dir === 0 ? -PEG_NUDGE : PEG_NUDGE;
        vy *= BOUNCE; // mild damp on peg hit
        nextRow += 1;
      }

      onUpdate(x, y, vy);

      // Reached the slot floor
      if (y >= 1) break;
      steps += 1;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Internal deterministic primitives (inlined to honor zero-import).   */
/* ------------------------------------------------------------------ */

/** FNV-1a 32-bit. Mirrors `src/shared/games/engine/rng.ts#hashStringToSeed`. */
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG. Same algorithm as the project's shared RNG utility. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

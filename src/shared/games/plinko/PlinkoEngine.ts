/**
 * PlinkoEngine — Provably Fair + 결정론적 물리 시뮬레이션 엔진
 *
 * 역할:
 *  - dropPath: (seed, rows, risk) → 경로/finalSlot/multiplier 결정론적 산출
 *  - simulatePhysics: 시각화용 균일 progress 샘플 emit (Renderer가 시간 기반 플레이백)
 *
 * 순수성 규약: React/DOM 의존 0. Web Worker / Edge Function 이식 가능.
 *
 * TODO: Real money 모드 — dropPath를 Supabase Edge Function으로 권위 이관.
 *       서버가 server_seed + nonce로 결정, 클라이언트는 결과만 신뢰.
 *       Multiplier 테이블도 서버에서 검증.
 */

export type RiskLevel = "low" | "medium" | "high";
export type RowCount = 8 | 12 | 16;

export interface PlinkoDropResult {
  path: number[];
  finalSlot: number;
  multiplier: number;
  totalRows: RowCount;
  risk: RiskLevel;
  seed: string;
  serverHash?: string;
  serverSeed?: string;
  clientSeed?: string;
  nonce?: number;
}

const ALLOWED_ROWS = [8, 12, 16] as const;

/**
 * Stake.com 표준 배수 테이블. 좌우 대칭, length = rows + 1.
 * Real money에서는 서버 측 값과 정확히 일치해야 함.
 */
export const MULTIPLIERS: Record<RiskLevel, Record<RowCount, number[]>> = {
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
    12: [76, 18, 5, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 5, 18, 76],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export const SLOT_COUNT: Record<RowCount, number> = { 8: 9, 12: 13, 16: 17 };

export const SUBSTEPS_PER_ROW = 14;
export const FALL_SUBSTEPS = 14;

export class PlinkoEngine {
  public dropPath(seed: string, rows: number, risk: RiskLevel = "medium"): PlinkoDropResult {
    if (!ALLOWED_ROWS.includes(rows as RowCount)) {
      throw new Error(`Plinko: rows must be 8, 12 or 16 (got ${rows})`);
    }

    const r = rows as RowCount;
    const rand = mulberry32(hashSeed(seed));
    const path: number[] = [];
    let finalSlot = 0;

    for (let i = 0; i < r; i++) {
      const dir = rand() < 0.5 ? 0 : 1;
      path.push(dir);
      finalSlot += dir;
    }

    const table = MULTIPLIERS[risk][r];
    if (!table || table.length !== r + 1) {
      throw new Error(`Multiplier table mismatch for rows=${r}`);
    }

    const multiplier = table[finalSlot];
    if (multiplier === undefined) {
      throw new Error(`Missing multiplier for rows=${r} slot=${finalSlot}`);
    }

    return { path, finalSlot, multiplier, totalRows: r, risk, seed };
  }

  /**
   * simulatePhysics — 균일 progress 샘플 emit.
   *  - progress: 0 → 1 단조 증가, 마지막 sample은 progress=1.0 도달 보장
   *  - 각 row 구간 SUBSTEPS_PER_ROW + final fall FALL_SUBSTEPS+1 = (rows+1)*14 + 1 샘플
   */
  public simulatePhysics(
    result: PlinkoDropResult,
    onUpdate: (x: number, y: number, vy: number, progress: number) => void,
  ): void {
    const { path, totalRows, finalSlot } = result;
    const rows = totalRows;
    const slotCount = rows + 1;
    const yStep = 1.0 / (rows + 1);

    let x = 0.5;
    let cumRight = 0;

    // row-by-row peg traversal
    for (let row = 0; row < rows; row++) {
      cumRight += path[row];
      const xStart = x;
      const xEnd = (cumRight + 0.5) / (row + 2);
      const yStart = row * yStep;
      const yEnd = (row + 1) * yStep;

      for (let sub = 0; sub < SUBSTEPS_PER_ROW; sub++) {
        const t = sub / SUBSTEPS_PER_ROW;
        const easeY = t * t;
        const easeX = 1 - (1 - t) * (1 - t);

        const currX = xStart + (xEnd - xStart) * easeX;
        const currY = yStart + (yEnd - yStart) * easeY;
        const currVY = (yEnd - yStart) * 2 * t;

        const progress = (row + sub / SUBSTEPS_PER_ROW) / (rows + 1);
        onUpdate(currX, currY, currVY, progress);
      }

      x = xEnd;
    }

    // final fall into slot
    const xStartFall = x;
    const xEndFall = (finalSlot + 0.5) / slotCount;
    const yStartFall = rows * yStep;
    const yEndFall = 1.0;

    for (let sub = 0; sub <= FALL_SUBSTEPS; sub++) {
      const t = sub / FALL_SUBSTEPS;
      const easeY = t * t;
      const easeX = 1 - (1 - t) * (1 - t);

      const currX = xStartFall + (xEndFall - xStartFall) * easeX;
      const currY = yStartFall + (yEndFall - yStartFall) * easeY;
      const currVY = (yEndFall - yStartFall) * 2 * t;

      const progress = (rows + sub / FALL_SUBSTEPS) / (rows + 1);
      onUpdate(currX, currY, currVY, progress);
    }
  }
}

/* ------------------------------------------------------------------ */
/* PRNG primitives — inlined for zero-import. Matches src/shared/games/engine/rng.ts. */

function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

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

/**
 * Max multiplier for a given (risk, rows). Single source of truth — derived
 * directly from MULTIPLIERS so UI (BetSummary) auto-syncs when tables change.
 */
export function getMaxMultiplier(risk: RiskLevel, rows: RowCount): number {
  return Math.max(...MULTIPLIERS[risk][rows]);
}

/**
 * PlinkoEngine — 지존급 Provably Fair + 고품질 물리 엔진 (완전판)
 *
 * 목표: Stake.com + Rollbit을 압도하는 수준의 결정론, 물리, 확장성
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

export const MULTIPLIERS: Record<RiskLevel, Record<RowCount, number[]>> = {
  /* ... 동일 */
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
   * simulatePhysics
   * - progress는 0.0 ~ 1.0 구간에서 단조 증가
   * - 각 row 구간과 final fall 구간 내부에서는 균일 간격
   * - Renderer가 시간 기반 플레이백 하기에 충분히 안정적
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

    // row-by-row
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

    // final fall
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
function hashSeed(input: string): number {
  /* ... */
}
function mulberry32(seed: number): () => number {
  /* ... */
}

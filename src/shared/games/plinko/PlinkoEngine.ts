/**
 * PlinkoEngine — 지존급 Provably Fair + 고품질 물리 엔진
 *
 * 목표: Stake.com + Rollbit을 압도하는 수준의 결정론, 물리, 확장성
 * 특징: 완전 순수, Web Worker 이식 용이, 서버 권위 대비 구조 포함
 */

export type RiskLevel = "low" | "medium" | "high";

export interface PlinkoDropResult {
  path: number[]; // 0 = left, 1 = right
  finalSlot: number;
  multiplier: number;
  totalRows: number;
  risk: RiskLevel;
  seed: string;
  serverHash?: string; // Real money 모드에서 서버 검증용
}

const ALLOWED_ROWS = [8, 12, 16] as const;

const MULTIPLIERS: Record<RiskLevel, Record<number, number[]>> = {
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

export class PlinkoEngine {
  /**
   * Provably Fair 핵심 메서드 — 동일 입력 = 항상 동일 결과
   */
  public dropPath(seed: string, rows: number, risk: RiskLevel = "medium"): PlinkoDropResult {
    if (!ALLOWED_ROWS.includes(rows as any)) {
      throw new Error(`Plinko: rows must be 8, 12 or 16 (got ${rows})`);
    }

    const rand = mulberry32(hashSeed(seed));
    const path: number[] = [];
    let finalSlot = 0;

    for (let i = 0; i < rows; i++) {
      const dir = rand() < 0.5 ? 0 : 1;
      path.push(dir);
      finalSlot += dir;
    }

    const multiplier = MULTIPLIERS[risk][rows][finalSlot] ?? 1.0;

    return {
      path,
      finalSlot,
      multiplier,
      totalRows: rows,
      risk,
      seed,
    };
  }

  /**
   * 고품질 시각화용 물리 시뮬레이션 (Renderer에서 rAF로 소비)
   */
  public simulatePhysics(
    result: PlinkoDropResult,
    onUpdate: (x: number, y: number, vy: number, progress: number) => void,
  ): void {
    const { path, totalRows } = result;
    const rowGap = 1 / (totalRows + 1);

    let x = 0.5;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let progress = 0;

    for (let row = 0; row < path.length; row++) {
      for (let subStep = 0; subStep < 12; subStep++) {
        // 부드러운 보간
        vy += 0.0011;
        vy *= 0.982;
        vx *= 0.978;

        x += vx;
        y += vy;

        // Peg 충돌
        if (y >= (row + 1) * rowGap) {
          const dir = path[row];
          vx += dir === 0 ? -0.018 : 0.018;
          vy *= 0.52; // 강한 bounce
          y = (row + 1) * rowGap;
        }

        progress = (row + subStep / 12) / path.length;
        onUpdate(x, y, vy, progress);
      }
    }

    // 최종 슬롯에 정확히 도착
    onUpdate(result.finalSlot / totalRows, 1.0, 0, 1.0);
  }
}

/* ------------------------------------------------------------------ */
/* Internal deterministic helpers */
/* ------------------------------------------------------------------ */

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
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

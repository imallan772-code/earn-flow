/**
 * MinesEngine — Stake-style 5×5 Mines, RTP 99%.
 *
 * 결정 이유 / 수식
 *  - 보드: 5×5 = 25타일. 지뢰 m ∈ [1, 24].
 *  - 캐쉬아웃 배수 m(r, mineCount) — r개의 안전 타일을 연속으로 깐 직후:
 *      m(0, _) = 1.0  (0-reveal 보호 — 아직 베팅 환수만 가능, 이익 없음)
 *      m(r, M) = RTP × ∏_{i=0..r-1} (25 - i) / (25 - M - i)
 *    (RTP = 0.99 — 엔진은 RTP 99% 표준. 모드별 추가 하우스 엣지는 호출부에서
 *     `houseEdge.profitOf(bet, mult, mode)`로 적용 — Crash/Dice와 동일 이중 구조.)
 *  - 지뢰 배치: PF(provablyFair) 바이트로 Fisher-Yates 셔플. 동일 (serverSeed,
 *    clientSeed, nonce, mineCount) 입력은 항상 같은 배치를 만든다.
 *
 * 순수 함수만 export. React/DOM 의존 0. spec은 환경 무관.
 *
 * TODO(real-money): 지뢰 배치는 서버 시드 공개 시점까지 클라이언트가 모르도록
 *  Edge Function이 결정해야 함. 본 엔진은 그대로 검증용으로 재사용 가능.
 */
import { drawFloats, type ProvablyFairInput } from "../engine/provablyFair";

export const BOARD_SIZE = 5;
export const TOTAL_TILES = BOARD_SIZE * BOARD_SIZE; // 25
export const MIN_MINES = 1;
export const MAX_MINES = TOTAL_TILES - 1; // 24
export const MINES_RTP = 0.99;

/** 0-reveal 보호 — 아직 정산 의미 없음. */
export function nextMultiplier(revealedSafe: number, mineCount: number): number {
  if (revealedSafe <= 0) return 1.0;
  const m = clampMines(mineCount);
  const r = Math.max(0, Math.min(TOTAL_TILES - m, revealedSafe));
  let mult = MINES_RTP;
  for (let i = 0; i < r; i++) {
    mult *= (TOTAL_TILES - i) / (TOTAL_TILES - m - i);
  }
  return mult;
}

/** [1, 24]로 클램프. */
export function clampMines(mineCount: number): number {
  if (!Number.isFinite(mineCount)) return MIN_MINES;
  return Math.max(MIN_MINES, Math.min(MAX_MINES, Math.floor(mineCount)));
}

/**
 * PF로 지뢰 위치를 결정. 인덱스 [0, 24] 중 `mineCount`개를 오름차순으로 반환.
 *
 * Fisher-Yates: 24회 스왑이면 충분(마지막 i=0은 자기 자신과 스왑).
 */
export async function placeMines(input: ProvablyFairInput, mineCount: number): Promise<number[]> {
  const m = clampMines(mineCount);
  const floats = await drawFloats(input, TOTAL_TILES - 1);
  const tiles = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  for (let i = TOTAL_TILES - 1; i > 0; i--) {
    const j = Math.floor(floats[TOTAL_TILES - 1 - i] * (i + 1));
    const safeJ = Math.max(0, Math.min(i, j));
    [tiles[i], tiles[safeJ]] = [tiles[safeJ], tiles[i]];
  }
  return tiles.slice(0, m).sort((a, b) => a - b);
}

export function isMine(tileIndex: number, mines: readonly number[]): boolean {
  return mines.includes(tileIndex);
}

/** 베팅 환수 포함 총 페이아웃 (gross). */
export function payoutGross(bet: number, revealedSafe: number, mineCount: number): number {
  return bet * nextMultiplier(revealedSafe, mineCount);
}

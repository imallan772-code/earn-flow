/**
 * WheelEngine — Stake-style Wheel. RTP 99% (엔진 내장), single-step.
 *
 * 구조
 *  - risk 3 (`low|medium|high`) × segments 3 (`10|20|30`) = 9 테이블.
 *  - 각 테이블 길이 = segments. 평균 = RTP_TARGET (0.99).
 *  - spin: PF float ∈ [0,1) → index = floor(u * segments).
 *  - multiplier 0 = 패배(crediting 없음, 호출부 처리).
 *  - 모드 RTP 0.97은 `houseEdge.profitOf`에서 추가 적용 (이중 RTP, Crash/Dice/Mines와 동일).
 *
 * 테이블 설계 (각 길이당 평균 = 0.99)
 *  - low:  잦은 소액 회수 — 1.5×/1.2×/0.3× 혼합, 0× 일부.
 *  - med:  중간 변동성 — 1.8×/3.0× 혼합, 0× 다수.
 *  - high: 한방 노림 — 단 1개 슬롯에 큰 jackpot, 나머지 모두 0×.
 *
 *  segments=20/30은 10패턴을 단순 반복(평균 동일하게 보존).
 *
 * TODO(real-money): `spin`은 Edge Function 위임. 테이블·계산은 그대로 재사용.
 */
import { bytesGenerator, floatFromBytes, type ProvablyFairInput } from "../engine/provablyFair";

export const WHEEL_RTP_TARGET = 0.99;

export type WheelRisk = "low" | "medium" | "high";
export type WheelSegments = 10 | 20 | 30;

export const WHEEL_RISKS: readonly WheelRisk[] = ["low", "medium", "high"] as const;
export const WHEEL_SEGMENT_OPTIONS: readonly WheelSegments[] = [10, 20, 30] as const;

// 길이 10, 평균 = 0.99
const LOW_10: readonly number[] = [1.5, 0, 1.2, 1.5, 1.2, 1.5, 1.2, 0, 1.5, 0.3];
const MED_10: readonly number[] = [0, 0, 0, 1.8, 0, 3.0, 0, 1.8, 3.0, 0.3];
const HIGH_10: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 9.9];

function repeat(base: readonly number[], times: number): readonly number[] {
  const out: number[] = [];
  for (let t = 0; t < times; t++) out.push(...base);
  return out;
}

const TABLE: Record<WheelRisk, Record<WheelSegments, readonly number[]>> = {
  low: { 10: LOW_10, 20: repeat(LOW_10, 2), 30: repeat(LOW_10, 3) },
  medium: { 10: MED_10, 20: repeat(MED_10, 2), 30: repeat(MED_10, 3) },
  high: { 10: HIGH_10, 20: repeat(HIGH_10, 2), 30: repeat(HIGH_10, 3) },
};

export function getSegments(risk: WheelRisk, segments: WheelSegments): readonly number[] {
  return TABLE[risk][segments];
}

export function multiplierAt(
  risk: WheelRisk,
  segments: WheelSegments,
  index: number,
): number {
  const arr = getSegments(risk, segments);
  if (arr.length === 0) return 0;
  const safeIdx = Math.max(0, Math.min(arr.length - 1, Math.floor(index)));
  return arr[safeIdx];
}

/** PF 기반 인덱스 추첨. 결과 ∈ [0, segments). */
export async function spin(
  input: ProvablyFairInput,
  segments: WheelSegments,
): Promise<number> {
  const bytes = await bytesGenerator(input, 0);
  const u = floatFromBytes(bytes, 0);
  const idx = Math.floor(u * segments);
  return Math.max(0, Math.min(segments - 1, idx));
}

/** 평균 multiplier (엔진 RTP). 테스트 + UI 표시용. */
export function expectedMultiplier(risk: WheelRisk, segments: WheelSegments): number {
  const arr = getSegments(risk, segments);
  let sum = 0;
  for (const x of arr) sum += x;
  return sum / arr.length;
}

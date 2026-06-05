/**
 * LimboEngine — Stake-style Limbo. RTP 99%, single-step.
 *
 * 수식 (Stake 공개 공식과 수학적으로 동치, RTP 99%)
 *  - u = floatFromBytes(bytes, 0) ∈ [0, 1)
 *  - rawCrash = (100 - u) / (1 - u)   → [100, ∞)
 *  - crashPoint = max(1.00, floor(rawCrash) / 100)
 *  - 결과적으로 약 1%의 u값(0 ≤ u < ~0.01)이 crashPoint = 1.00을 만들어
 *    엔진 RTP 99%가 자연스럽게 내장된다.
 *  - isWin(target): crashPoint >= target (경계 포함)
 *  - winChance(target)% ≈ 99 / target  (target >= 1.01)
 *  - payoutMultiplier(target) = target  (모드 0.97은 호출부 `houseEdge.profitOf`)
 *
 * 결정 이유
 *  - PF 스택은 Dice와 동일 `bytesGenerator`(1 stream) 재사용 → 셸·엔진 패턴 통일.
 *  - 엔진 RTP 99% 내장 + 모드 RTP 0.97 이중 구조 → Crash/Dice/Mines와 동일.
 *  - (1 - u)는 1e-12로 클램프하여 div-by-zero 방지.
 *
 * TODO(real-money): `computeCrashPoint`는 Edge Function 위임. 본 엔진은 검증용으로 재사용.
 */
import { bytesGenerator, floatFromBytes, type ProvablyFairInput } from "../engine/provablyFair";

export const LIMBO_RTP = 0.99;
export const MIN_TARGET = 1.01;
export const MAX_TARGET = 1_000_000;
export const MIN_CRASH = 1.0;

/** 결정론 crash point ∈ [1.00, MAX_TARGET]. */
export async function computeCrashPoint(input: ProvablyFairInput): Promise<number> {
  const bytes = await bytesGenerator(input, 0);
  const u = floatFromBytes(bytes, 0);
  const denom = Math.max(1e-12, 1 - u);
  const raw = (100 - u) / denom; // Stake-style RTP 99% formula
  const crash = Math.floor(raw) / 100;
  return Math.max(MIN_CRASH, Math.min(MAX_TARGET, crash));
}

export function clampTarget(target: number): number {
  if (!Number.isFinite(target)) return MIN_TARGET;
  return Math.max(MIN_TARGET, Math.min(MAX_TARGET, target));
}

/** 경계 포함 (crashPoint == target → win). */
export function isWin(crashPoint: number, target: number): boolean {
  return crashPoint >= target;
}

/** 승률 % (0 ~ ~99). */
export function winChance(target: number): number {
  const t = clampTarget(target);
  return (LIMBO_RTP * 100) / t;
}

/** 엔진 RTP 99% 내장 배당 — 모드 RTP는 호출부 적용. */
export function payoutMultiplier(target: number): number {
  return clampTarget(target);
}

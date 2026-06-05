/**
 * useGameRound — 게임 라운드 phase 머신 (single-step + multi-step 분기).
 *
 * 역할
 *  - `idle → rolling/playing → settled → idle` 단일 phase 머신.
 *  - 영속 데이터는 store에서, 임시 UI phase는 본 훅 내부 `useState`로 분리.
 *
 * 패턴
 *  - single-step (Dice/Limbo/Wheel/Keno): place() → "rolling" → (rollingMs 후) → "settled" → (settledMs 후) → "idle"
 *  - multi-step  (Crash/HiLo/Mines)     : place() → "playing" → 외부 settle() 호출 → "settled" → "idle"
 *
 * 결정 이유 (LOVABLE_WORK_RULES §5, §8)
 *  - 비즈 로직(roll 계산·정산·credit/debit)은 컨슈머가 useEffect로 phase 변화에 반응하며 처리.
 *    훅은 phase 전이만 책임. 단일 책임 원칙.
 *  - phase가 store에 들어가면 새로고침 시 "rolling" 복원 같은 버그가 생김 → useState로 격리.
 *  - `reset()`은 모드 전환·디버그용. 호출 안 하면 기존 동작 불변.
 */
import { useCallback, useEffect, useState } from "react";

export type RoundPhase = "idle" | "rolling" | "playing" | "settled";

interface SingleStepOptions {
  isMultiStep?: false;
  /** "rolling" → "settled" 자동 전이 지연. 기본 800ms. */
  rollingMs?: number;
  /** "settled" → "idle" 자동 전이 지연. 기본 800ms. */
  settledMs?: number;
}

interface MultiStepOptions {
  isMultiStep: true;
  /** "settled" → "idle" 자동 전이 지연. 기본 800ms. */
  settledMs?: number;
}

export type UseGameRoundOptions = SingleStepOptions | MultiStepOptions;

export interface UseGameRoundReturn {
  phase: RoundPhase;
  isIdle: boolean;
  isActive: boolean;
  isSettled: boolean;
  /** 베팅 시작. idle이 아니면 false 반환(중복 베팅 차단). */
  place: () => boolean;
  /** multi-step 전용. playing → settled. single-step에서는 no-op. */
  settle: () => void;
  /** 강제 idle 복귀. */
  reset: () => void;
}

const DEFAULT_ROLLING_MS = 800;
const DEFAULT_SETTLED_MS = 800;

export function useGameRound(options: UseGameRoundOptions): UseGameRoundReturn {
  const [phase, setPhase] = useState<RoundPhase>("idle");
  const isMulti = options.isMultiStep === true;
  const rollingMs = !isMulti ? (options.rollingMs ?? DEFAULT_ROLLING_MS) : DEFAULT_ROLLING_MS;
  const settledMs = options.settledMs ?? DEFAULT_SETTLED_MS;

  const place = useCallback((): boolean => {
    if (phase !== "idle") return false;
    setPhase(isMulti ? "playing" : "rolling");
    return true;
  }, [phase, isMulti]);

  const settle = useCallback(() => {
    if (!isMulti) return;
    setPhase((p) => (p === "playing" ? "settled" : p));
  }, [isMulti]);

  const reset = useCallback(() => setPhase("idle"), []);

  // single-step: rolling → settled 자동 전이
  useEffect(() => {
    if (isMulti || phase !== "rolling") return;
    const id = window.setTimeout(() => setPhase("settled"), rollingMs);
    return () => window.clearTimeout(id);
  }, [phase, isMulti, rollingMs]);

  // settled → idle 자동 전이
  useEffect(() => {
    if (phase !== "settled") return;
    const id = window.setTimeout(() => setPhase("idle"), settledMs);
    return () => window.clearTimeout(id);
  }, [phase, settledMs]);

  return {
    phase,
    isIdle: phase === "idle",
    isActive: phase === "rolling" || phase === "playing",
    isSettled: phase === "settled",
    place,
    settle,
    reset,
  };
}

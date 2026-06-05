/**
 * Session stats — memory only (no localStorage). ROUND 0+ games derive display from here.
 */
import { useSyncExternalStore } from "react";

export interface SessionStats {
  pnl: number;
  bestMultiplier: number;
  winStreak: number;
  lossStreak: number;
  rounds: number;
}

const initial: SessionStats = {
  pnl: 0,
  bestMultiplier: 0,
  winStreak: 0,
  lossStreak: 0,
  rounds: 0,
};

let state = { ...initial };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

export function getSessionStats(): SessionStats {
  return state;
}

export function resetSessionStats(): void {
  state = { ...initial };
  emit();
}

export function recordSessionOutcome(input: {
  profit: number;
  multiplier?: number;
  outcome: "win" | "loss";
}): void {
  const mult = input.multiplier ?? 0;
  state = {
    ...state,
    pnl: state.pnl + input.profit,
    bestMultiplier: Math.max(state.bestMultiplier, mult),
    winStreak: input.outcome === "win" ? state.winStreak + 1 : 0,
    lossStreak: input.outcome === "loss" ? state.lossStreak + 1 : 0,
    rounds: state.rounds + 1,
  };
  emit();
}

export function useSessionStats(): SessionStats {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => initial,
  );
}

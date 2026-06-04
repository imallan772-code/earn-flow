/**
 * Persisted game state — survives navigation and refresh.
 * Module-level store + localStorage + useSyncExternalStore. No deps.
 */
import { useSyncExternalStore } from "react";

interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (cb: () => void) => () => void;
  use: <S>(selector: (state: T) => S) => S;
}

function createStore<T extends object>(key: string, initial: T, version = 1): Store<T> {
  const storageKey = `phonara.gamestate.${key}.v${version}`;
  const listeners = new Set<() => void>();

  let state: T = (() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return initial;
      return { ...initial, ...JSON.parse(raw) } as T;
    } catch {
      return initial;
    }
  })();

  let flushHandle: number | null = null;
  function scheduleFlush() {
    if (typeof window === "undefined" || flushHandle != null) return;
    flushHandle = window.setTimeout(() => {
      flushHandle = null;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* quota — ignore */
      }
    }, 80);
  }

  function set(next: T | ((prev: T) => T)) {
    const computed = typeof next === "function" ? (next as (p: T) => T)(state) : next;
    if (computed === state) return;
    state = computed;
    scheduleFlush();
    listeners.forEach((cb) => cb());
  }

  function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  function use<S>(selector: (s: T) => S): S {
    return useSyncExternalStore(subscribe, () => selector(state), () => selector(initial));
  }

  return { get: () => state, set, subscribe, use };
}

// ───────── DICE ─────────
export interface DiceRoll { id: string; roll: number; win: boolean }
export interface DiceOutcome { outcome: "win" | "loss"; profit: number; nonce: number; roll: number }
export interface DicePersisted {
  balance: number;
  nonce: number;
  history: DiceRoll[];
  lastRoll: number | null;
  lastOutcome: DiceOutcome | null;
  target: number;
  diceMode: "over" | "under";
  pendingAmount: number;
}
export const diceStore = createStore<DicePersisted>("dice", {
  balance: 1000,
  nonce: 0,
  history: [],
  lastRoll: null,
  lastOutcome: null,
  target: 50,
  diceMode: "over",
  pendingAmount: 10,
});

// ───────── CRASH ─────────
export interface CrashHistoryItem { id: string; multiplier: number }
export interface CrashOutcome { outcome: "win" | "loss"; profit: number; nonce: number }
export interface CrashPersisted {
  balance: number;
  nonce: number;
  history: CrashHistoryItem[];
  lastOutcome: CrashOutcome | null;
  pendingAmount: number;
  pendingTarget: number;
}
export const crashStore = createStore<CrashPersisted>("crash", {
  balance: 1000,
  nonce: 0,
  history: [],
  lastOutcome: null,
  pendingAmount: 10,
  pendingTarget: 2.0,
});

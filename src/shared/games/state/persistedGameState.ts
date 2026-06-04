/**
 * persistedGameState — 게임별 영속 상태 (잔액·히스토리·대기 베팅 등)
 *
 * 역할
 *  - 새로고침/네비게이션 사이에서 게임 상태를 유지한다.
 *  - 외부 의존성 0(zustand 미사용). `useSyncExternalStore` + localStorage만 사용.
 *  - SSR-safe: `window` 가드를 두고, 서버에서는 initial을 그대로 반환.
 *
 * 결정 이유
 *  - 번들/일관성/SSR 안전성 측면에서 zustand 도입 회피.
 *  - 80ms debounce로 연속 업데이트 시 localStorage write를 합쳐 비용을 줄임.
 *  - 머지 규칙은 `{ ...initial, ...parsed }` 고정 — 신규 필드를 추가해도 기존
 *    저장본이 호환되도록 보수적 머지.
 *
 * Round G Part 1 마이그레이션 방향
 *  - 본 파일의 createStore는 `src/shared/games/shell/createGameStore.ts` 팩토리로
 *    추출 예정. 이 파일은 추출 후에도 `diceStore`/`crashStore` 두 export만
 *    유지하며, 외부 시그니처와 localStorage key는 절대 변경하지 않는다.
 *  - 본 정리 라운드에서는 외부 동작/시그니처/키/머지/디바운스 전부 불변.
 */
import { useSyncExternalStore } from "react";

interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (cb: () => void) => () => void;
  use: <S>(selector: (state: T) => S) => S;
}

/**
 * SSR-safe 초기 로드. 서버에서는 initial을, 브라우저에서는 localStorage 머지본을
 * 반환한다. parse 실패/쿼터 등 모든 예외는 무시하고 initial로 폴백.
 */
function hydrate<T extends object>(storageKey: string, initial: T): T {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return initial;
    return { ...initial, ...JSON.parse(raw) } as T;
  } catch {
    return initial;
  }
}

/**
 * 80ms debounce flush 스케줄러. 동일 tick 내 다중 set()은 1회 write로 합쳐진다.
 * 쿼터 초과 등 write 예외는 의도적으로 무시(앱 동작에 영향 X).
 */
function createDebouncedFlusher<T>(
  storageKey: string,
  getState: () => T,
  delay = 80,
): { schedule: () => void } {
  // 브라우저에서는 `window.setTimeout`이 number를 반환하지만, 타입 정의는 환경에
  // 따라 NodeJS.Timeout으로 좁혀질 수 있다. 둘 다 안전하게 흡수하기 위해
  // `ReturnType<typeof setTimeout>`을 사용.
  let handle: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (typeof window === "undefined" || handle != null) return;
      handle = setTimeout(() => {
        handle = null;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(getState()));
        } catch {
          /* quota — ignore */
        }
      }, delay);
    },
  };
}

// TODO(Round G Part 1): 이 createStore를 src/shared/games/shell/createGameStore.ts
// 팩토리로 추출. 본 파일은 diceStore/crashStore 두 export만 유지하고
// factory import로 교체 예정. 외부 시그니처/localStorage key는 불변.
function createStore<T extends object>(key: string, initial: T, version = 1): Store<T> {
  const storageKey = `phonara.gamestate.${key}.v${version}`;
  const listeners = new Set<() => void>();

  let state: T = hydrate(storageKey, initial);

  const flusher = createDebouncedFlusher(storageKey, () => state);

  function set(next: T | ((prev: T) => T)) {
    const computed = typeof next === "function" ? (next as (p: T) => T)(state) : next;
    if (computed === state) return;
    state = computed;
    flusher.schedule();
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
// Dice 게임 잔액/nonce/히스토리/마지막 결과/타깃·모드/대기 베팅 보존.
// src/features/games/dice/DiceScreen.tsx에서 사용.
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
// TODO: Real money 모드에서는 balance/history/nonce를 Supabase로 이관.
// localStorage는 optimistic cache로만 사용하고, settle은 Edge Function RPC로 위임.
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
// Crash 게임 잔액/nonce/히스토리/마지막 결과/대기 베팅/대기 자동캐쉬아웃 보존.
// src/features/games/crash/CrashScreen.tsx에서 사용.
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
// TODO: Real money 모드에서는 balance/history/nonce를 Supabase로 이관.
// localStorage는 optimistic cache로만 사용하고, settle은 Edge Function RPC로 위임.
export const crashStore = createStore<CrashPersisted>("crash", {
  balance: 1000,
  nonce: 0,
  history: [],
  lastOutcome: null,
  pendingAmount: 10,
  pendingTarget: 2.0,
});

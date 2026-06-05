/**
 * createGameStore — 게임별 영속 스토어 팩토리.
 *
 * 역할
 *  - `persistedGameState.ts` 내부에 박혀 있던 `createStore`를 외부화. 외부 시그니처·
 *    localStorage key·머지 규칙·80ms debounce·SSR 가드 100% 보존.
 *  - zustand 미사용. `useSyncExternalStore` + localStorage.
 *
 * 결정 이유 (LOVABLE_WORK_RULES §3)
 *  - 의존성 최소화 + 기존 코드(`diceStore`/`crashStore`) 호환을 위해 시그니처 불변.
 *  - 80ms debounce로 연속 set() 시 localStorage write를 합쳐 비용 절감.
 *  - 머지 규칙은 `{ ...initial, ...parsed }` 고정 — 신규 필드 추가에도 기존 저장본 호환.
 *
 * TODO(real-money): 진짜 잔액/베팅 영속화는 서버 권한 모델로 이전. 본 스토어는
 *  UI 임시 캐시/사용자 선호 영속화 용도로만 유지.
 */
import { useSyncExternalStore } from "react";

export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (cb: () => void) => () => void;
  use: <S>(selector: (state: T) => S) => S;
}

/**
 * SSR-safe 초기 로드. 서버에서는 initial을, 브라우저에서는 localStorage 머지본을
 * 반환. parse 실패/쿼터 등 모든 예외는 무시하고 initial로 폴백.
 *
 * ROUND L-2-pre: optional `migrate`로 게임별 변환 훅 추가.
 *  - 기본 동작: `{ ...initial, ...parsed }` (기존 호환, 다른 게임 0-diff)
 *  - migrate를 넘기면 raw localStorage payload(없으면 `null`)와 initial을 받아 최종 state를 반환.
 *    limbo v1 → v2 변환처럼 키 변경/legacy fallback 시에 사용.
 */
function hydrate<T extends object>(
  storageKey: string,
  initial: T,
  migrate?: (parsed: unknown, initial: T) => T,
): T {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (migrate) return migrate(parsed, initial);
    if (parsed == null) return initial;
    return { ...initial, ...(parsed as object) } as T;
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

/**
 * 게임별 영속 스토어 생성. localStorage key = `phonara.gamestate.<key>.v<version>`.
 *
 * 호환성: 기존 diceStore(v2)·crashStore(v2)는 동일 key로 그대로 로드된다.
 * 신규 게임은 v1로 시작.
 */
export function createGameStore<T extends object>(key: string, initial: T, version = 1): Store<T> {
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
    return useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(initial),
    );
  }

  return { get: () => state, set, subscribe, use };
}

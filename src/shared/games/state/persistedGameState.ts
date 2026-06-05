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
/**
 *  - Round G Part 1: createStore가 `shell/createGameStore.ts`로 외부화됨.
 *    본 파일은 게임별 store 선언만 유지. 외부 시그니처·localStorage key·머지
 *    규칙은 100% 보존.
 */
import { createGameStore } from "@/shared/games/shell/createGameStore";


// ───────── DICE ─────────
// Dice 게임 nonce/히스토리/마지막 결과/타깃·모드/대기 베팅 보존.
// balance는 src/shared/wallet/walletStore에서 모드별로 관리.
export interface DiceRoll {
  id: string;
  roll: number;
  win: boolean;
}
export interface DiceOutcome {
  outcome: "win" | "loss";
  profit: number;
  nonce: number;
  roll: number;
}
export interface DicePersisted {
  nonce: number;
  history: DiceRoll[];
  lastRoll: number | null;
  lastOutcome: DiceOutcome | null;
  target: number;
  diceMode: "over" | "under";
  pendingAmount: number;
}
export const diceStore = createStore<DicePersisted>(
  "dice",
  {
    nonce: 0,
    history: [],
    lastRoll: null,
    lastOutcome: null,
    target: 50,
    diceMode: "over",
    pendingAmount: 10,
  },
  2,
);

// ───────── CRASH ─────────
// Crash 게임 nonce/히스토리/마지막 결과/대기 베팅/대기 자동캐쉬아웃 보존.
// balance는 walletStore에서 관리.
export interface CrashHistoryItem {
  id: string;
  multiplier: number;
}
export interface CrashOutcome {
  outcome: "win" | "loss";
  profit: number;
  nonce: number;
}
export interface CrashPersisted {
  nonce: number;
  history: CrashHistoryItem[];
  lastOutcome: CrashOutcome | null;
  pendingAmount: number;
  pendingTarget: number;
}
export const crashStore = createStore<CrashPersisted>(
  "crash",
  {
    nonce: 0,
    history: [],
    lastOutcome: null,
    pendingAmount: 10,
    pendingTarget: 2.0,
  },
  2,
);

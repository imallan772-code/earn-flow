/**
 * persistedGameState — 게임별 영속 상태 (nonce·히스토리·대기 베팅·사용자 선호).
 *
 * 역할
 *  - 새로고침/네비게이션 사이에서 게임 UI 상태를 유지한다.
 *  - 외부 의존성 0(zustand 미사용). `useSyncExternalStore` + localStorage.
 *  - balance는 `src/shared/wallet/walletStore`에서 모드별로 관리.
 *
 * Round G Part 1 결과
 *  - `createStore`는 `shell/createGameStore.ts`로 외부화 완료. 본 파일은 게임별
 *    store 선언만 유지. 외부 시그니처·localStorage key·머지 규칙·디바운스 100% 보존.
 *  - 기존 dice(v2)·crash(v2) 저장본은 그대로 로드된다. 신규 게임은 v1로 시작.
 *
 * TODO(real-money): 잔액/베팅 신뢰 데이터는 Supabase 권한 모델로 이전. 본 스토어는
 *  UI 임시 캐시(nonce·history·사용자 선호 입력값) 용도로 격하 예정.
 */
import { createGameStore } from "@/shared/games/shell/createGameStore";

// ───────── DICE ─────────
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
export const diceStore = createGameStore<DicePersisted>(
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
export const crashStore = createGameStore<CrashPersisted>(
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

// ───────── MINES ─────────
// Mines 게임 nonce/히스토리/마지막 결과/지뢰 개수/대기 베팅 + 진행중 라운드/클라이언트 시드.
// ROUND H: activeRound + clientSeed 추가. version=1 유지 (createGameStore 머지 규칙
// `{ ...initial, ...parsed }`로 기존 저장본은 신규 필드만 기본값으로 주입됨 — migrate 불필요).
export interface MinesHistoryItem {
  id: string;
  mineCount: number;
  revealed: number;
  multiplier: number;
  win: boolean;
}
export interface MinesOutcome {
  outcome: "win" | "loss";
  profit: number;
  nonce: number;
  mineCount: number;
  revealed: number;
  multiplier: number;
}
/**
 * 진행 중 라운드 스냅샷. 새로고침 복원용.
 *  - `liveBetId`는 LiveBetsFeed의 동일 베팅 카드를 update할 수 있도록 보존.
 *  - bomb hit / cashout 시점에 같은 tick으로 `null` 처리 → 새로고침 시 bomb 상태 미복원.
 */
export interface ActiveMinesRound {
  nonce: number;
  amount: number;
  mineCount: number;
  mines: number[];
  revealed: number[];
  liveBetId: string;
  placedAt: number;
}
export interface MinesPersisted {
  nonce: number;
  history: MinesHistoryItem[];
  lastOutcome: MinesOutcome | null;
  mineCount: number;
  pendingAmount: number;
  /** 진행 중 라운드 (없으면 null). */
  activeRound: ActiveMinesRound | null;
  /** PF 클라이언트 시드. 사용자가 PF 모달에서 변경 가능. 기본 = 기존 상수와 동일. */
  clientSeed: string;
}
export const minesStore = createGameStore<MinesPersisted>(
  "mines",
  {
    nonce: 0,
    history: [],
    lastOutcome: null,
    mineCount: 3,
    pendingAmount: 10,
    activeRound: null,
    clientSeed: "phonara-player-001",
  },
  1,
);

// ───────── PLINKO ─────────
export interface PlinkoHistoryItem {
  id: string;
  multiplier: number;
  slot: number;
}
export interface PlinkoOutcome {
  outcome: "win" | "loss";
  profit: number;
  multiplier: number;
  bet: number;
  payout: number;
  nonce: number;
  jackpot: boolean;
}
export interface PlinkoPersisted {
  nonce: number;
  history: PlinkoHistoryItem[];
  lastOutcome: PlinkoOutcome | null;
  rows: 8 | 12 | 16;
  risk: "low" | "medium" | "high";
  pendingAmount: number;
}
export const plinkoStore = createGameStore<PlinkoPersisted>(
  "plinko",
  {
    nonce: 0,
    history: [],
    lastOutcome: null,
    rows: 16,
    risk: "medium",
    pendingAmount: 10,
  },
  1,
);

// ───────── LIMBO ─────────
// 본 라운드 P2 신규(v1). MinesScreen single-step 패턴 + useGameRound({ rollingMs, settledMs }).
export interface LimboHistoryItem {
  id: string;
  crashPoint: number;
  target: number;
  win: boolean;
}
export interface LimboOutcome {
  outcome: "win" | "loss";
  profit: number;
  nonce: number;
  crashPoint: number;
  target: number;
}
export interface LimboPersisted {
  nonce: number;
  history: LimboHistoryItem[];
  lastOutcome: LimboOutcome | null;
  target: number;
  pendingAmount: number;
}
export const limboStore = createGameStore<LimboPersisted>(
  "limbo",
  {
    nonce: 0,
    history: [],
    lastOutcome: null,
    target: 2.0,
    pendingAmount: 10,
  },
  1,
);

// ───────── WHEEL ─────────
// 본 라운드 P2 신규(v1). risk × segments 가중 세그먼트 휠.
export interface WheelHistoryItem {
  id: string;
  risk: "low" | "medium" | "high";
  segments: 10 | 20 | 30;
  index: number;
  multiplier: number;
  win: boolean;
}
export interface WheelOutcome {
  outcome: "win" | "loss";
  profit: number;
  nonce: number;
  risk: "low" | "medium" | "high";
  segments: 10 | 20 | 30;
  index: number;
  multiplier: number;
}
export interface WheelPersisted {
  nonce: number;
  history: WheelHistoryItem[];
  lastOutcome: WheelOutcome | null;
  risk: "low" | "medium" | "high";
  segments: 10 | 20 | 30;
  pendingAmount: number;
}
export const wheelStore = createGameStore<WheelPersisted>(
  "wheel",
  {
    nonce: 0,
    history: [],
    lastOutcome: null,
    risk: "medium",
    segments: 20,
    pendingAmount: 10,
  },
  1,
);

// ───────── SFX (ROUND 0) ─────────
// UI sound prefs only — not wallet. Key: phonara.gamestate.sfx.v1
export interface SfxPersisted {
  enabled: boolean;
  volume: number;
}
export const sfxStore = createGameStore<SfxPersisted>(
  "sfx",
  {
    enabled: true,
    volume: 0.7,
  },
  1,
);

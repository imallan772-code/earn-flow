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
  /** PF 클라이언트 시드. PF 모달에서 변경 가능. ROUND K 추가 — version=2 유지(머지). */
  clientSeed: string;
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
    clientSeed: "phonara-player-001",
  },
  2,
);

// ───────── CRASH ─────────
// ROUND L-1: clientSeed + activeRound 추가. version=2 유지 (createGameStore 머지 규칙
// `{ ...initial, ...parsed }`로 기존 v2 저장본은 신규 필드만 기본값으로 주입 — migrate 불필요).
export interface CrashHistoryItem {
  id: string;
  multiplier: number;
}
export interface CrashOutcome {
  outcome: "win" | "loss";
  profit: number;
  nonce: number;
}
/**
 * 진행 중 라운드 스냅샷. 새로고침 복원용.
 *
 * 시각 필드 의미 — 절대 혼동 금지:
 *  - `placedAt`        : 베팅 클릭 시각 (epoch ms, Date.now). 디버깅·정렬용.
 *  - `bettingStartedAt`: betting phase **진입 시점**(라운드 타이머 시작)의 `performance.now()` 스냅샷.
 *                        place 시 그 값을 그대로 복사. placedAt을 넣으면 refresh 후 타이머가 어긋남.
 *  - `startedAt`       : running 진입 `performance.now()` 스냅샷 (0 = 아직 betting).
 *
 * settle 시점(crashed)에 같은 tick으로 `null` 처리 (이중 차감 절대 금지).
 */
export interface ActiveCrashRound {
  nonce: number;
  amount: number;
  autoTarget: number;
  cashedAt: number | null;
  liveBetId: string;
  placedAt: number;
  crashPoint: number;
  startedAt: number;
  bettingStartedAt: number;
}
export interface CrashPersisted {
  nonce: number;
  history: CrashHistoryItem[];
  lastOutcome: CrashOutcome | null;
  pendingAmount: number;
  pendingTarget: number;
  /** 진행 중 라운드 (없으면 null). */
  activeRound: ActiveCrashRound | null;
  /** PF 클라이언트 시드. PF 모달에서 변경 가능. */
  clientSeed: string;
}
export const crashStore = createGameStore<CrashPersisted>(
  "crash",
  {
    nonce: 0,
    history: [],
    lastOutcome: null,
    pendingAmount: 10,
    pendingTarget: 2.0,
    activeRound: null,
    clientSeed: "phonara-player-001",
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
// ROUND L-2-pre: 단일 슬롯 환원. v2 key (`phonara.gamestate.limbo.v2`) + v1 multi-slot
// legacy 1회 read → migrate(refund 양 슬롯) → v2 persist.
//
// migrate 책임 (sync, hydrate 시점):
//  - v2 키 없으면 v1 (`phonara.gamestate.limbo.v1`) 1회 read.
//  - parsed.activeRounds 가 튜플이면 non-null 항목별 { amount, nonce } → pendingLegacyRefunds push.
//  - lastOutcome = parsed.lastOutcomeBySlot?.find(Boolean) ?? parsed.lastOutcome ?? null
//  - activeRound = null (UI carry-over 없음; 양 슬롯 모두 refund 대상)
//  - 실제 refund() RPC 호출은 LimboScreen mount effect에서 drain (sync hydrate는 auth 없음).
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
/**
 * 진행 중 라운드 스냅샷. 새로고침 복원용.
 *  - settle 시점에 같은 tick으로 `null` 처리 (이중 차감 절대 금지).
 */
export interface ActiveLimboRound {
  nonce: number;
  amount: number;
  target: number;
  liveBetId: string;
  placedAt: number;
}
/** Legacy v1 → v2 fold 시점에 채워지는 mid-round refund 대기 항목. */
export interface PendingLegacyRefund {
  amount: number;
  nonce: number;
}
export interface LimboPersisted {
  nonce: number;
  history: LimboHistoryItem[];
  lastOutcome: LimboOutcome | null;
  target: number;
  pendingAmount: number;
  /** 진행 중 라운드 (없으면 null). 단일 슬롯. */
  activeRound: ActiveLimboRound | null;
  /** PF 클라이언트 시드. 모달에서 변경 가능. */
  clientSeed: string;
  /** Legacy v1 multi-slot fold 시 채워지는 refund 대기. mount drain 후 즉시 비움. */
  pendingLegacyRefunds: PendingLegacyRefund[];
}

const LIMBO_V1_KEY = "phonara.gamestate.limbo.v1";

/** v1 multi-slot 저장본 → v2 single-slot 변환 + pendingLegacyRefunds 채우기. */
export function migrateLimboPersisted(parsed: unknown, initial: LimboPersisted): LimboPersisted {
  // v2 키에 데이터가 이미 있으면 그것을 사용 + 신규 필드 기본값 머지.
  if (parsed && typeof parsed === "object") {
    return { ...initial, ...(parsed as object) } as LimboPersisted;
  }
  // v2 없음 → v1 legacy 1회 read.
  if (typeof window === "undefined") return initial;
  let legacy: Record<string, unknown> | null = null;
  try {
    const raw = window.localStorage.getItem(LIMBO_V1_KEY);
    if (raw) legacy = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return initial;
  }
  if (!legacy) return initial;

  const pendingLegacyRefunds: PendingLegacyRefund[] = [];
  const ars = legacy.activeRounds;
  if (Array.isArray(ars)) {
    for (const ar of ars) {
      if (ar && typeof ar === "object") {
        const amount = Number((ar as { amount?: unknown }).amount);
        const ncRaw = (ar as { nonce?: unknown }).nonce;
        const nonce = Number(ncRaw);
        if (Number.isFinite(amount) && amount > 0 && Number.isFinite(nonce)) {
          pendingLegacyRefunds.push({ amount, nonce });
        }
      }
    }
  }

  let lastOutcome: LimboOutcome | null = null;
  const slotOutcomes = legacy.lastOutcomeBySlot;
  if (Array.isArray(slotOutcomes)) {
    const first = slotOutcomes.find(Boolean);
    if (first && typeof first === "object") lastOutcome = first as LimboOutcome;
  }
  if (!lastOutcome && legacy.lastOutcome && typeof legacy.lastOutcome === "object") {
    lastOutcome = legacy.lastOutcome as LimboOutcome;
  }

  const pickNumber = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const pickString = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  const history = Array.isArray(legacy.history) ? (legacy.history as LimboHistoryItem[]) : [];

  return {
    ...initial,
    nonce: pickNumber(legacy.nonce, initial.nonce),
    history,
    lastOutcome,
    target: pickNumber(legacy.target, initial.target),
    pendingAmount: pickNumber(legacy.pendingAmount, initial.pendingAmount),
    activeRound: null,
    clientSeed: pickString(legacy.clientSeed, initial.clientSeed),
    pendingLegacyRefunds,
  };
}

export const limboStore = createGameStore<LimboPersisted>(
  "limbo",
  {
    nonce: 0,
    history: [],
    lastOutcome: null,
    target: 2.0,
    pendingAmount: 10,
    activeRound: null,
    clientSeed: "phonara-player-001",
    pendingLegacyRefunds: [],
  },
  2,
  migrateLimboPersisted,
);

// ───────── WHEEL ─────────
// ROUND J: activeRound + clientSeed 추가. version=1 유지 (createGameStore 머지 규칙
// `{ ...initial, ...parsed }`로 기존 저장본은 신규 필드만 기본값으로 주입 — migrate 불필요).
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
/**
 * 진행 중 라운드 스냅샷. 새로고침 복원용.
 *  - `liveBetId`는 LiveBetsFeed의 동일 베팅 카드를 update할 수 있도록 보존.
 *  - settle 시점에 같은 tick으로 `null` 처리 (이중 차감 절대 금지).
 */
export interface ActiveWheelRound {
  nonce: number;
  amount: number;
  risk: "low" | "medium" | "high";
  segments: 10 | 20 | 30;
  liveBetId: string;
  placedAt: number;
}
export interface WheelPersisted {
  nonce: number;
  history: WheelHistoryItem[];
  lastOutcome: WheelOutcome | null;
  risk: "low" | "medium" | "high";
  segments: 10 | 20 | 30;
  pendingAmount: number;
  /** 진행 중 라운드 (없으면 null). */
  activeRound: ActiveWheelRound | null;
  /** PF 클라이언트 시드. PF 모달에서 변경 가능. */
  clientSeed: string;
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
    activeRound: null,
    clientSeed: "phonara-player-001",
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

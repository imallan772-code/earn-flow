/**
 * walletStore — unified demo + real wallet shared across Dice/Crash/Plinko.
 *
 * Demo wallet:
 *   - 1회성 체험 크레딧 (`INITIAL_DEMO_GRANT`).
 *   - 잔액 소진 시 리필 없음. `openOutOfDemoModal()` 트리거.
 *   - `granted` 플래그로 새로고침/재방문 시 재지급 차단.
 *
 * Real wallet:
 *   - 초기 0. 입금 화면으로 유도(이 라운드에선 mock).
 *
 * Stats:
 *   - 데모 통계(`totalBets`, `totalWagered`, `netResult`, `maxMultiplier`)는
 *     OutOfDemoModal에서 노출.
 *
 * SSR-safe: 모든 storage 접근은 `typeof window` 가드 + try/catch.
 */
import { useSyncExternalStore } from "react";
import type { GameMode } from "@/shared/mode/ModeContext";

export const INITIAL_DEMO_GRANT = 10_000;
export const DEMO_LOW_RATIO = 0.3;

const STORAGE_KEY = "phonara.wallet.v1";

interface WalletState {
  demoBalance: number;
  demoGranted: boolean;
  realBalance: number;
  totalBets: number;
  totalWagered: number;
  netResult: number;
  maxMultiplier: number;
}

const DEFAULT_STATE: WalletState = {
  demoBalance: INITIAL_DEMO_GRANT,
  demoGranted: true,
  realBalance: 0,
  totalBets: 0,
  totalWagered: 0,
  netResult: 0,
  maxMultiplier: 0,
};

// ───── Storage ─────
function hydrate(): WalletState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    // ?reset_demo=1 → wipe demo state for dev
    if (window.location.search.includes("reset_demo=1")) {
      window.localStorage.removeItem(STORAGE_KEY);
      // strip the param so it doesn't keep resetting
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_demo");
      window.history.replaceState({}, "", url.toString());
      return DEFAULT_STATE;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<WalletState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

let state: WalletState = hydrate();
const listeners = new Set<() => void>();
let flushHandle: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (typeof window === "undefined" || flushHandle) return;
  flushHandle = setTimeout(() => {
    flushHandle = null;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota — ignore */
    }
  }, 80);
}

function emit() {
  listeners.forEach((l) => l());
}

function set(next: Partial<WalletState>) {
  state = { ...state, ...next };
  persist();
  emit();
}

/** Sync Supabase real-mode PHON balance into the local game wallet. */
export function syncRealBalance(amount: number) {
  if (amount < 0 || state.realBalance === amount) return;
  set({ realBalance: amount });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ───── Out-of-demo modal store ─────
interface OutOfDemoModalState {
  open: boolean;
  attemptedAmount: number;
}
let modalState: OutOfDemoModalState = { open: false, attemptedAmount: 0 };
const modalListeners = new Set<() => void>();
function emitModal() {
  modalListeners.forEach((l) => l());
}

export function openOutOfDemoModal(attemptedAmount = 0) {
  modalState = { open: true, attemptedAmount };
  emitModal();
}
export function closeOutOfDemoModal() {
  modalState = { open: false, attemptedAmount: 0 };
  emitModal();
}
export function useOutOfDemoModal(): OutOfDemoModalState {
  return useSyncExternalStore(
    (cb) => {
      modalListeners.add(cb);
      return () => {
        modalListeners.delete(cb);
      };
    },
    () => modalState,
    () => modalState,
  );
}

// ───── Public API ─────
export const wallet = {
  getBalance(mode: GameMode): number {
    return mode === "demo" ? state.demoBalance : state.realBalance;
  },
  /** Try to debit; returns true on success, false on insufficient funds.
   *  On false in demo mode, also opens the OutOfDemo modal. */
  tryDebit(mode: GameMode, amount: number): boolean {
    if (amount <= 0) return false;
    const current = mode === "demo" ? state.demoBalance : state.realBalance;
    if (amount > current) {
      if (mode === "demo") openOutOfDemoModal(amount);
      return false;
    }
    if (mode === "demo") {
      set({
        demoBalance: state.demoBalance - amount,
        totalBets: state.totalBets + 1,
        totalWagered: state.totalWagered + amount,
        netResult: state.netResult - amount,
      });
    } else {
      set({ realBalance: state.realBalance - amount });
    }
    return true;
  },
  /** Credit a payout (gross — includes returned stake on win). */
  credit(mode: GameMode, amount: number, multiplier?: number) {
    if (amount <= 0) return;
    if (mode === "demo") {
      const nextMax =
        multiplier && multiplier > state.maxMultiplier ? multiplier : state.maxMultiplier;
      set({
        demoBalance: state.demoBalance + amount,
        netResult: state.netResult + amount,
        maxMultiplier: nextMax,
      });
    } else {
      set({ realBalance: state.realBalance + amount });
    }
  },
  /** Refund an unsettled stake (mid-round leave). No stat changes. */
  refund(mode: GameMode, amount: number) {
    if (amount <= 0) return;
    if (mode === "demo") {
      set({
        demoBalance: state.demoBalance + amount,
        totalWagered: Math.max(0, state.totalWagered - amount),
        netResult: state.netResult + amount,
        totalBets: Math.max(0, state.totalBets - 1),
      });
    } else {
      set({ realBalance: state.realBalance + amount });
    }
  },
  /** Dev-only: reset demo wallet to initial grant. */
  resetDemo() {
    set({
      demoBalance: INITIAL_DEMO_GRANT,
      demoGranted: true,
      totalBets: 0,
      totalWagered: 0,
      netResult: 0,
      maxMultiplier: 0,
    });
  },
  /** Snapshot for read-only consumers (modal stats). */
  snapshot(): WalletState {
    return state;
  },
};

// ───── React hooks ─────
export function useBalance(mode: GameMode): number {
  return useSyncExternalStore(
    subscribe,
    () => (mode === "demo" ? state.demoBalance : state.realBalance),
    () => (mode === "demo" ? state.demoBalance : state.realBalance),
  );
}

export function useWalletStats(): WalletState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** True when demo balance ≤ 30% of initial grant. */
export function useIsDemoLow(): boolean {
  const bal = useBalance("demo");
  return bal > 0 && bal <= INITIAL_DEMO_GRANT * DEMO_LOW_RATIO;
}

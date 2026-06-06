/**
 * walletStore — demo (local per account) + real (RPC cache) game wallet.
 *
 * Demo (Stake-tier):
 *   - Scope: guest (`__guest__`) vs authenticated user (`userId`).
 *   - Each scope gets its own ₩10,000 one-time grant on first visit.
 *   - No cross-account bleed from shared browser storage.
 *   - Not real money — localStorage FOMO/UX only.
 *
 * Real:
 *   - `realBalance` mirrors Supabase PHON via `syncRealBalance` (display/cache only).
 *   - Mutations = RPC only (`useGameWallet`).
 */
import { useSyncExternalStore } from "react";
import type { GameMode } from "@/shared/mode/ModeContext";

export const INITIAL_DEMO_GRANT = 10_000;
export const DEMO_LOW_RATIO = 0.3;

const LEGACY_STORAGE_KEY = "phonara.wallet.v1";
const VAULT_STORAGE_KEY = "phonara.wallet.v2";
const GUEST_SCOPE = "__guest__";

export interface WalletState {
  demoBalance: number;
  demoGranted: boolean;
  realBalance: number;
  totalBets: number;
  totalWagered: number;
  netResult: number;
  maxMultiplier: number;
}

interface WalletVault {
  version: 2;
  scopes: Record<string, WalletState>;
}

function freshWalletState(): WalletState {
  return {
    demoBalance: INITIAL_DEMO_GRANT,
    demoGranted: true,
    realBalance: 0,
    totalBets: 0,
    totalWagered: 0,
    netResult: 0,
    maxMultiplier: 0,
  };
}

function normalizeScope(raw: Partial<WalletState> | undefined): WalletState {
  const base = freshWalletState();
  if (!raw) return base;
  const demoBalance =
    typeof raw.demoBalance === "number" && Number.isFinite(raw.demoBalance)
      ? Math.max(0, raw.demoBalance)
      : base.demoBalance;
  return {
    ...base,
    ...raw,
    demoBalance,
    demoGranted: raw.demoGranted ?? base.demoGranted,
    realBalance:
      typeof raw.realBalance === "number" && Number.isFinite(raw.realBalance)
        ? Math.max(0, raw.realBalance)
        : 0,
    totalBets: typeof raw.totalBets === "number" ? Math.max(0, raw.totalBets) : 0,
    totalWagered:
      typeof raw.totalWagered === "number" ? Math.max(0, raw.totalWagered) : 0,
    netResult: typeof raw.netResult === "number" ? raw.netResult : 0,
    maxMultiplier:
      typeof raw.maxMultiplier === "number" ? Math.max(0, raw.maxMultiplier) : 0,
  };
}

function readVault(): WalletVault {
  if (typeof window === "undefined") {
    return { version: 2, scopes: {} };
  }
  try {
    const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WalletVault>;
      if (parsed.version === 2 && parsed.scopes && typeof parsed.scopes === "object") {
        return { version: 2, scopes: parsed.scopes as Record<string, WalletState> };
      }
    }
  } catch {
    /* fall through to migration */
  }
  return migrateLegacyVault();
}

function migrateLegacyVault(): WalletVault {
  const vault: WalletVault = { version: 2, scopes: {} };
  if (typeof window === "undefined") return vault;
  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      vault.scopes[GUEST_SCOPE] = normalizeScope(JSON.parse(legacy) as Partial<WalletState>);
    }
  } catch {
    /* ignore corrupt legacy */
  }
  return vault;
}

function writeVault(vault: WalletVault) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch {
    /* quota */
  }
}

function scopeKey(userId: string | null | undefined): string {
  return userId ?? GUEST_SCOPE;
}

function loadScopeFromVault(key: string): WalletState {
  const vault = readVault();
  const saved = vault.scopes[key];
  if (saved) return normalizeScope(saved);
  return freshWalletState();
}

function saveScopeToVault(key: string, snapshot: WalletState) {
  const vault = readVault();
  vault.scopes[key] = snapshot;
  writeVault(vault);
}

function handleDevReset(): WalletState {
  if (typeof window === "undefined") return freshWalletState();
  if (!window.location.search.includes("reset_demo=1")) {
    return loadScopeFromVault(GUEST_SCOPE);
  }
  window.localStorage.removeItem(VAULT_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  const url = new URL(window.location.href);
  url.searchParams.delete("reset_demo");
  window.history.replaceState({}, "", url.toString());
  return freshWalletState();
}

let activeScopeKey = GUEST_SCOPE;
let state: WalletState = typeof window === "undefined" ? freshWalletState() : handleDevReset();

const listeners = new Set<() => void>();
let flushHandle: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (typeof window === "undefined" || flushHandle) return;
  flushHandle = setTimeout(() => {
    flushHandle = null;
    saveScopeToVault(activeScopeKey, state);
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

/** Switch demo/real cache to the signed-in user (or guest). Call from AuthProvider. */
export function setWalletScope(userId: string | null | undefined) {
  const nextKey = scopeKey(userId);
  if (nextKey === activeScopeKey) return;

  saveScopeToVault(activeScopeKey, state);
  activeScopeKey = nextKey;
  state = loadScopeFromVault(nextKey);
  persist();
  emit();
}

/** Sync Supabase real-mode PHON balance into the local game wallet cache. */
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
  snapshot(): WalletState {
    return state;
  },
  /** Test / dev introspection */
  activeScope(): string {
    return activeScopeKey;
  },
};

export function useBalance(mode: GameMode): number {
  return useSyncExternalStore(
    subscribe,
    () => (mode === "demo" ? state.demoBalance : state.realBalance),
    () => (mode === "demo" ? state.demoBalance : state.realBalance),
  );
}

export function useWalletStats(): WalletState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function useIsDemoLow(): boolean {
  const bal = useBalance("demo");
  return bal > 0 && bal <= INITIAL_DEMO_GRANT * DEMO_LOW_RATIO;
}

/** For tests — reset module state without localStorage. */
export function __resetWalletStoreForTests(
  scope: string = GUEST_SCOPE,
  next: WalletState = freshWalletState(),
) {
  activeScopeKey = scope;
  state = next;
  emit();
}

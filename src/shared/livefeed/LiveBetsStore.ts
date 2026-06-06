/**
 * Live bets store — global ring buffer of bet events from bots AND real users.
 *
 * - useSyncExternalStore-friendly subscribe/getSnapshot.
 * - Capped at MAX_BETS most-recent items.
 * - `isMe` flag highlights the current user's own bets in the feed.
 */
import { randomMaskedNick } from "./nicknames";

export type LiveGame =
  | "crash"
  | "dice"
  | "plinko"
  | "slots"
  | "mines"
  | "roulette"
  | "limbo"
  | "wheel";
export type LiveStatus = "pending" | "cashout" | "bust" | "win" | "loss";

export interface LiveBet {
  id: string;
  user: string;
  game: LiveGame;
  amount: number;
  multiplier: number | null;
  profit: number | null;
  status: LiveStatus;
  mode: "demo" | "real";
  ts: number;
  isMe?: boolean;
}

export const ME_USER_LABEL = "나의_베팅";

const MAX_BETS = 200;

let buffer: LiveBet[] = [];
let totalVolume = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function nextId(): string {
  return `lb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cancelStaleMePending(game: LiveGame): void {
  buffer = buffer.map((b) =>
    b.isMe && b.game === game && b.status === "pending"
      ? { ...b, status: "bust", profit: -b.amount, multiplier: null }
      : b,
  );
}

export const liveBetsStore = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  getSnapshot(): LiveBet[] {
    return buffer;
  },

  getTotalVolume(): number {
    return totalVolume;
  },

  push(bet: Omit<LiveBet, "id" | "ts"> & { id?: string; ts?: number }): string {
    const id = bet.id ?? nextId();
    const ts = bet.ts ?? Date.now();
    const existingIdx = buffer.findIndex((b) => b.id === id);

    if (existingIdx >= 0) {
      const merged: LiveBet = { ...buffer[existingIdx], ...bet, id, ts };
      buffer = [merged, ...buffer.filter((_, i) => i !== existingIdx)].slice(0, MAX_BETS);
      emit();
      return id;
    }

    if (bet.isMe && bet.status === "pending") {
      cancelStaleMePending(bet.game);
    }

    const full: LiveBet = { ...bet, id, ts };
    buffer = [full, ...buffer].slice(0, MAX_BETS);
    totalVolume += bet.amount;
    emit();
    return id;
  },

  /**
   * Re-insert or refresh the user's in-flight bet after page restore (buffer is in-memory only).
   */
  ensureUserPending(bet: Omit<LiveBet, "ts"> & { id: string }): void {
    liveBetsStore.push({
      ...bet,
      user: ME_USER_LABEL,
      isMe: true,
      status: bet.status ?? "pending",
      multiplier: bet.multiplier ?? null,
      profit: bet.profit ?? null,
      ts: Date.now(),
    });
  },

  update(id: string, patch: Partial<Pick<LiveBet, "multiplier" | "profit" | "status">>): void {
    let changed = false;
    buffer = buffer.map((b) => {
      if (b.id !== id) return b;
      changed = true;
      return { ...b, ...patch };
    });
    if (changed) emit();
  },

  /**
   * Settle by id; if the row was evicted from the ring buffer (refresh / bot churn),
   * re-insert using `fallback` so ME rows never stay stuck on pending.
   */
  settle(
    id: string,
    patch: Partial<Pick<LiveBet, "multiplier" | "profit" | "status">>,
    fallback?: Omit<LiveBet, "id" | "ts">,
  ): void {
    if (buffer.some((b) => b.id === id)) {
      liveBetsStore.update(id, patch);
      return;
    }
    if (!fallback) return;
    liveBetsStore.push({
      ...fallback,
      ...patch,
      id,
      user: ME_USER_LABEL,
      isMe: true,
      ts: Date.now(),
    });
  },

  /** Test/dev only */
  __reset(): void {
    buffer = [];
    totalVolume = 0;
    emit();
  },
};

/**
 * Seed initial mock bets so the feed isn't empty on first paint.
 */
export function seedInitialBets(count = 20): void {
  if (buffer.length > 0) return;
  const games: LiveGame[] = ["crash", "crash", "crash", "dice", "dice", "slots", "mines"];
  for (let i = 0; i < count; i++) {
    const game = games[Math.floor(Math.random() * games.length)];
    const amount = Math.round(lognormalAmount() * 100) / 100;
    const isWin = Math.random() < 0.45;
    const mult = isWin ? +(1.2 + Math.random() * 8).toFixed(2) : 0;
    liveBetsStore.push({
      user: randomMaskedNick(),
      game,
      amount,
      multiplier: isWin ? mult : null,
      profit: isWin ? +(amount * (mult - 1)).toFixed(2) : -amount,
      status: isWin ? (game === "crash" ? "cashout" : "win") : game === "crash" ? "bust" : "loss",
      mode: Math.random() < 0.8 ? "real" : "demo",
      ts: Date.now() - (count - i) * 2000,
    });
  }
}

function lognormalAmount(): number {
  // shape: mostly 5-100, occasional 500-3000 whales
  const r = Math.random();
  if (r < 0.85) return 5 + Math.random() * 95;
  if (r < 0.97) return 100 + Math.random() * 400;
  return 500 + Math.random() * 2500;
}

/** Feed ordering: pin ME bets (pending first) so updates stay visible. */
export function orderLiveBetsForView(bets: LiveBet[], game?: LiveGame): LiveBet[] {
  const filtered = game ? bets.filter((b) => b.game === game) : bets;
  const me = filtered.filter((b) => b.isMe);
  const rest = filtered.filter((b) => !b.isMe);
  const mePending = me.filter((b) => b.status === "pending");
  const meDone = me.filter((b) => b.status !== "pending");
  return [...mePending, ...meDone, ...rest];
}

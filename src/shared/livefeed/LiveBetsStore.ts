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
    const full: LiveBet = { ...bet, id, ts };
    buffer = [full, ...buffer].slice(0, MAX_BETS);
    totalVolume += bet.amount;
    emit();
    return id;
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

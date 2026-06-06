/**
 * Live cashout ticker — global ring buffer (display only).
 */
import { randomGlobalUser } from "./feedStreamContent";
import { globalLiveStats } from "./globalLiveStats";

export type CashoutCurrency = "PHON" | "USDT";

export interface CashoutEvent {
  id: string;
  name: string;
  flag: string;
  amount: number;
  currency: CashoutCurrency;
  multiplier?: number;
  ts: number;
}

const MAX = 48;
let events: CashoutEvent[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function nextId(): string {
  return `co_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function maskName(name: string): string {
  if (name.length <= 4) return name + "***";
  return name.slice(0, Math.min(4, name.length - 1)) + "***";
}

function rollCashout(): Omit<CashoutEvent, "id" | "ts"> {
  const user = randomGlobalUser();
  const currency: CashoutCurrency = Math.random() < 0.52 ? "PHON" : "USDT";
  const multiplier = +(1.4 + Math.random() * 86).toFixed(1);
  if (currency === "PHON") {
    const amount = Math.floor(80_000 + Math.random() * 9_200_000);
    return { name: maskName(user.name), flag: user.flag, amount, currency, multiplier };
  }
  const amount = +(12 + Math.random() * 4_880).toFixed(2);
  return { name: maskName(user.name), flag: user.flag, amount, currency, multiplier };
}

export const cashoutStripStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getEvents: () => events,
  push(data?: Partial<Omit<CashoutEvent, "id" | "ts">> & { ts?: number }) {
    const rolled = rollCashout();
    const event: CashoutEvent = {
      id: nextId(),
      name: data?.name ?? rolled.name,
      flag: data?.flag ?? rolled.flag,
      amount: data?.amount ?? rolled.amount,
      currency: data?.currency ?? rolled.currency,
      multiplier: data?.multiplier ?? rolled.multiplier,
      ts: data?.ts ?? Date.now(),
    };
    events = [event, ...events].slice(0, MAX);
    globalLiveStats.onCashout(
      event.currency === "PHON" ? Math.floor(8_000 + Math.random() * 42_000) : 0,
      event.currency === "USDT" ? +(1.2 + Math.random() * 18).toFixed(2) : 0,
    );
    emit();
    return event.id;
  },
  __reset() {
    events = [];
    emit();
  },
};

export function seedCashoutStrip(count = 16): void {
  if (events.length > 0) return;
  for (let i = 0; i < count; i++) {
    cashoutStripStore.push({ ts: Date.now() - (count - i) * 2_800 });
  }
}

let timer: number | null = null;
let refs = 0;

function tick() {
  cashoutStripStore.push();
  timer = window.setTimeout(tick, 2_800 + Math.random() * 3_200);
}

export function startCashoutBot(): () => void {
  refs++;
  if (refs === 1 && timer === null) {
    seedCashoutStrip();
    timer = window.setTimeout(tick, 1_200);
  }
  return () => {
    refs = Math.max(0, refs - 1);
    if (refs === 0 && timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
}

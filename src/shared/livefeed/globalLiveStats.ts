/**
 * Global live activity counters — 10M-user scale FOMO (display only).
 */
import {
  MOCK_CONCURRENT_PEAK,
  MOCK_REALTIME_CASHOUT_PHON,
  MOCK_REALTIME_CASHOUT_USDT,
} from "@/mocks/fomo";
import { subscribeLiveTick } from "@/shared/motion/liveTickScheduler";

let concurrentBettors = MOCK_CONCURRENT_PEAK;
let sessionVolumeUsdt = 8_470_000;
let cashoutPhonToday = MOCK_REALTIME_CASHOUT_PHON;
let cashoutUsdtToday = MOCK_REALTIME_CASHOUT_USDT;
let betsPerSecond = 2_840;
let winsToday = 1_284_000;

const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

function emit() {
  listeners.forEach((fn) => fn());
}

function jitterConcurrent() {
  const delta = Math.floor((Math.random() - 0.42) * 4_200);
  concurrentBettors = Math.max(298_000, Math.min(356_000, concurrentBettors + delta));
  betsPerSecond = Math.max(
    2_100,
    Math.min(4_800, betsPerSecond + Math.floor((Math.random() - 0.48) * 180)),
  );
  winsToday += Math.floor(18 + Math.random() * 42);
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (listeners.size === 1) {
    unsubscribe = subscribeLiveTick(jitterConcurrent, 2200);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

export const globalLiveStats = {
  subscribe,
  getConcurrentBettors: () => concurrentBettors,
  getSessionVolumeUsdt: () => sessionVolumeUsdt,
  getCashoutPhonToday: () => cashoutPhonToday,
  getCashoutUsdtToday: () => cashoutUsdtToday,
  getBetsPerSecond: () => betsPerSecond,
  getWinsToday: () => winsToday,
  onBet(amountUsdt: number) {
    sessionVolumeUsdt += amountUsdt;
    emit();
  },
  onCashout(phon: number, usdt: number) {
    cashoutPhonToday += phon;
    cashoutUsdtToday += usdt;
    winsToday += 1;
    emit();
  },
  __reset() {
    concurrentBettors = MOCK_CONCURRENT_PEAK;
    sessionVolumeUsdt = 8_470_000;
    cashoutPhonToday = MOCK_REALTIME_CASHOUT_PHON;
    cashoutUsdtToday = MOCK_REALTIME_CASHOUT_USDT;
    betsPerSecond = 2_840;
    winsToday = 1_284_000;
    emit();
  },
};

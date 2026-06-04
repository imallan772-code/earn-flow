export interface CrashHistoryEntry {
  id: string;
  multiplier: number;
}

export const CRASH_HISTORY: CrashHistoryEntry[] = [
  1.24, 3.47, 1.08, 2.18, 8.92, 1.55, 1.01, 4.27, 2.04, 1.78,
  12.45, 1.32, 2.88, 1.19, 5.61, 1.04, 3.12, 1.91, 2.51, 1.67,
  1.02, 7.18, 1.44, 2.96, 1.13, 4.82, 1.28, 1.06, 3.55, 2.27,
].map((m, i) => ({ id: `h${i}`, multiplier: m }));

export interface LiveBet {
  id: string;
  user: string;
  bet: number;
  cashout: number | null;
  payout: number | null;
}

export const LIVE_BETS_SEED: LiveBet[] = [
  { id: "b1", user: "phona***", bet: 25, cashout: 2.14, payout: 53.5 },
  { id: "b2", user: "byte***", bet: 100, cashout: null, payout: null },
  { id: "b3", user: "stak***", bet: 12, cashout: 5.81, payout: 69.72 },
  { id: "b4", user: "nova***", bet: 50, cashout: 1.42, payout: 71 },
  { id: "b5", user: "zero***", bet: 8, cashout: null, payout: null },
  { id: "b6", user: "ai***", bet: 200, cashout: 1.08, payout: 216 },
  { id: "b7", user: "moon***", bet: 35, cashout: 3.27, payout: 114.45 },
];

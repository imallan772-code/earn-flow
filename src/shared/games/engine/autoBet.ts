/**
 * Auto-bet state machine — Stake.com 1:1 strategies.
 *
 * Pure reducer: `step(state, outcome) => nextState`.
 * No side effects, no timers — the host loop drives it.
 */

export type Strategy = "Flat" | "Martingale" | "AntiMartingale" | "Fibonacci" | "DAlembert";

export type Outcome = "win" | "loss";

export interface AutoBetConfig {
  strategy: Strategy;
  baseBet: number;
  /** 0 = infinite. */
  numberOfBets: number;
  /** Percent change applied to *current* bet on win. 0 = reset to base. */
  onWinIncreasePct: number;
  /** Percent change applied to *current* bet on loss. 0 = reset to base. */
  onLossIncreasePct: number;
  /** Stop when cumulative profit reaches this (>0 to enable). */
  stopOnProfit: number;
  /** Stop when cumulative loss reaches this (>0 to enable). Loss is positive. */
  stopOnLoss: number;
}

export interface AutoBetState {
  config: AutoBetConfig;
  currentBet: number;
  betsPlaced: number;
  pnl: number;
  /** Fibonacci index (only used by Fibonacci strategy). */
  fibIndex: number;
  running: boolean;
  stopReason: null | "count" | "profit" | "loss" | "manual";
}

export function initAutoBet(config: AutoBetConfig): AutoBetState {
  return {
    config,
    currentBet: config.baseBet,
    betsPlaced: 0,
    pnl: 0,
    fibIndex: 0,
    running: true,
    stopReason: null,
  };
}

/** Fibonacci sequence starting 1,1,2,3,5,... scaled by baseBet. */
function fibAt(i: number): number {
  let a = 1;
  let b = 1;
  for (let k = 0; k < i; k++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return a;
}

interface StepInput {
  outcome: Outcome;
  /** Net delta for this bet (positive on win, negative on loss). */
  delta: number;
}

/**
 * Apply one outcome and return the next state.
 * The next state's `currentBet` is the size to place on the NEXT round.
 */
export function step(state: AutoBetState, input: StepInput): AutoBetState {
  if (!state.running) return state;

  const { config } = state;
  const betsPlaced = state.betsPlaced + 1;
  const pnl = state.pnl + input.delta;

  // Decide next bet by strategy.
  let nextBet = state.currentBet;
  let nextFibIndex = state.fibIndex;

  switch (config.strategy) {
    case "Flat":
      nextBet = config.baseBet;
      break;

    case "Martingale":
      if (input.outcome === "loss") nextBet = state.currentBet * 2;
      else nextBet = config.baseBet;
      break;

    case "AntiMartingale":
      if (input.outcome === "win") nextBet = state.currentBet * 2;
      else nextBet = config.baseBet;
      break;

    case "Fibonacci":
      if (input.outcome === "loss") nextFibIndex = state.fibIndex + 1;
      else nextFibIndex = Math.max(0, state.fibIndex - 2);
      nextBet = config.baseBet * fibAt(nextFibIndex);
      break;

    case "DAlembert":
      if (input.outcome === "loss") nextBet = state.currentBet + config.baseBet;
      else nextBet = Math.max(config.baseBet, state.currentBet - config.baseBet);
      break;
  }

  // Apply on-win / on-loss percentage modifier (Stake "Increase by %").
  // 0 = reset to base, anything else multiplies current strategy bet.
  if (input.outcome === "win" && config.onWinIncreasePct !== 0) {
    nextBet = nextBet * (1 + config.onWinIncreasePct / 100);
  } else if (input.outcome === "loss" && config.onLossIncreasePct !== 0) {
    nextBet = nextBet * (1 + config.onLossIncreasePct / 100);
  }

  // Stop conditions.
  let running = true;
  let stopReason: AutoBetState["stopReason"] = null;
  if (config.numberOfBets > 0 && betsPlaced >= config.numberOfBets) {
    running = false;
    stopReason = "count";
  } else if (config.stopOnProfit > 0 && pnl >= config.stopOnProfit) {
    running = false;
    stopReason = "profit";
  } else if (config.stopOnLoss > 0 && pnl <= -config.stopOnLoss) {
    running = false;
    stopReason = "loss";
  }

  return {
    ...state,
    currentBet: nextBet,
    betsPlaced,
    pnl,
    fibIndex: nextFibIndex,
    running,
    stopReason,
  };
}

export function stopManual(state: AutoBetState): AutoBetState {
  return { ...state, running: false, stopReason: "manual" };
}

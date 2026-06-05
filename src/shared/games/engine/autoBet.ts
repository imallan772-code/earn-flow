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

  // Stake semantics: when a percent modifier is set for this outcome,
  // it OVERRIDES the strategy and compounds from currentBet. Otherwise the
  // strategy decides next bet (pct=0 effectively = "reset to base" for Flat).
  let nextBet = state.currentBet;
  let nextFibIndex = state.fibIndex;

  const pct = input.outcome === "win" ? config.onWinIncreasePct : config.onLossIncreasePct;

  if (pct !== 0) {
    nextBet = state.currentBet * (1 + pct / 100);
  } else {
    switch (config.strategy) {
      case "Flat":
        nextBet = config.baseBet;
        break;
      case "Martingale":
        nextBet = input.outcome === "loss" ? state.currentBet * 2 : config.baseBet;
        break;
      case "AntiMartingale":
        nextBet = input.outcome === "win" ? state.currentBet * 2 : config.baseBet;
        break;
      case "Fibonacci":
        nextFibIndex =
          input.outcome === "loss" ? state.fibIndex + 1 : Math.max(0, state.fibIndex - 2);
        nextBet = config.baseBet * fibAt(nextFibIndex);
        break;
      case "DAlembert":
        nextBet =
          input.outcome === "loss"
            ? state.currentBet + config.baseBet
            : Math.max(config.baseBet, state.currentBet - config.baseBet);
        break;
    }
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

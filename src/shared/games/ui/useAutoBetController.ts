/**
 * useAutoBetController — StakeBetPanel auto-bet loop.
 *
 * Triggers next bet when:
 *  1. Auto starts (first bet)
 *  2. autoCanPlace / canPlace opens (false → true)
 *  3. Outcome processed and strategy still running (Plinko idle gate, etc.)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AutoBetConfig,
  type AutoBetState,
  initAutoBet,
  step as autoStep,
} from "@/shared/games/engine/autoBet";

export interface AutoBetOutcome {
  outcome: "win" | "loss";
  profit: number;
  nonce: number;
}

export interface UseAutoBetControllerParams {
  canPlace: boolean;
  /** Auto loop readiness — defaults to canPlace. Plinko: idle + empty queue. */
  autoCanPlace?: boolean;
  hasActiveBet: boolean;
  balance: number;
  amount: number;
  target: number;
  minBet: number;
  lastOutcome?: AutoBetOutcome | null;
  bettingRoundKey?: number;
  onPlace: (amount: number, autoTarget: number) => boolean | Promise<boolean>;
}

export function useAutoBetController({
  canPlace,
  autoCanPlace,
  hasActiveBet,
  balance,
  amount,
  target,
  minBet,
  lastOutcome,
  bettingRoundKey,
  onPlace,
}: UseAutoBetControllerParams) {
  const [cfg, setCfg] = useState<AutoBetConfig>({
    strategy: "Flat",
    baseBet: 10,
    numberOfBets: 0,
    onWinIncreasePct: 0,
    onLossIncreasePct: 100,
    stopOnProfit: 0,
    stopOnLoss: 0,
  });
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoState, setAutoState] = useState<AutoBetState | null>(null);

  const lastOutcomeNonceRef = useRef<number | null>(null);
  const placedPhaseKeyRef = useRef<number | null>(null);
  const placingAutoRef = useRef(false);
  const prevReadyRef = useRef(autoCanPlace ?? canPlace);

  const readyForAuto = autoCanPlace ?? canPlace;

  const runtimeRef = useRef({
    autoRunning,
    autoState,
    hasActiveBet,
    balance,
    target,
    minBet,
    onPlace,
    bettingRoundKey,
    readyForAuto,
  });
  runtimeRef.current = {
    autoRunning,
    autoState,
    hasActiveBet,
    balance,
    target,
    minBet,
    onPlace,
    bettingRoundKey,
    readyForAuto,
  };

  useEffect(() => {
    if (!autoRunning) return;
    setAutoState((s) => {
      if (!s || !s.running) return s;
      if (s.currentBet === amount && s.config.baseBet === amount) return s;
      return { ...s, currentBet: amount, config: { ...s.config, baseBet: amount } };
    });
  }, [amount, autoRunning]);

  const attemptAutoPlace = useCallback(async (stateOverride?: AutoBetState) => {
    const rt = runtimeRef.current;
    if (!rt.autoRunning || rt.hasActiveBet || placingAutoRef.current) return;

    const state = stateOverride ?? rt.autoState;
    if (!state?.running) return;
    if (!rt.readyForAuto) return;

    const phaseKey = rt.bettingRoundKey ?? -1;
    if (placedPhaseKeyRef.current === phaseKey) return;

    const bet = Math.min(state.currentBet, rt.balance);
    if (rt.balance < rt.minBet || bet < rt.minBet) {
      setAutoRunning(false);
      return;
    }

    placingAutoRef.current = true;
    placedPhaseKeyRef.current = phaseKey;
    try {
      const result = rt.onPlace(bet, rt.target);
      const ok = result instanceof Promise ? await result : result;
      if (!ok) placedPhaseKeyRef.current = null;
    } finally {
      placingAutoRef.current = false;
    }
  }, []);

  // Outcome → strategy step → queue next bet when still running.
  useEffect(() => {
    if (!autoRunning || !lastOutcome || !autoState) return;
    if (lastOutcome.nonce === lastOutcomeNonceRef.current) return;
    lastOutcomeNonceRef.current = lastOutcome.nonce;

    const next = autoStep(autoState, {
      outcome: lastOutcome.outcome,
      delta: lastOutcome.profit,
    });
    setAutoState(next);
    if (!next.running) {
      setAutoRunning(false);
      return;
    }
    placedPhaseKeyRef.current = null;
    void attemptAutoPlace(next);
  }, [lastOutcome, autoRunning, autoState, attemptAutoPlace]);

  // Ready gate opens → place (covers Dice/Wheel idle flip + Plinko autoCanPlace).
  useEffect(() => {
    const prev = prevReadyRef.current;
    prevReadyRef.current = readyForAuto;
    if (!autoRunning || !autoState?.running) return;
    const firstStart = placedPhaseKeyRef.current === null;
    const justOpened = !prev && readyForAuto;
    if (!justOpened && !firstStart) return;
    void attemptAutoPlace();
  }, [
    readyForAuto,
    autoRunning,
    autoState,
    bettingRoundKey,
    balance,
    attemptAutoPlace,
  ]);

  function startAuto() {
    if (balance < minBet) return;
    const s = initAutoBet({ ...cfg, baseBet: amount });
    setAutoState(s);
    lastOutcomeNonceRef.current = null;
    placedPhaseKeyRef.current = null;
    setAutoRunning(true);
  }

  function stopAuto() {
    setAutoRunning(false);
    placedPhaseKeyRef.current = null;
  }

  return {
    cfg,
    setCfg,
    autoRunning,
    autoState,
    startAuto,
    stopAuto,
  };
}

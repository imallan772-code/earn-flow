/**
 * useAutoBetController — StakeBetPanel auto-bet loop (extracted, behavior frozen ROUND 0).
 * placedNonceRef / placingAutoRef / bettingRoundKey / debit-fail reset: move only, no logic changes.
 */
import { useEffect, useRef, useState } from "react";
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
  hasActiveBet: boolean;
  balance: number;
  amount: number;
  target: number;
  lastOutcome?: AutoBetOutcome | null;
  bettingRoundKey?: number;
  onPlace: (amount: number, autoTarget: number) => void | Promise<boolean>;
}

export function useAutoBetController({
  canPlace,
  hasActiveBet,
  balance,
  amount,
  target,
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
  const lastNonceRef = useRef<number | null>(null);
  const placedNonceRef = useRef<number | null>(null);
  const placingAutoRef = useRef(false);
  const prevCanPlaceRef = useRef(canPlace);

  useEffect(() => {
    if (!autoRunning) return;
    setAutoState((s) => {
      if (!s || !s.running) return s;
      if (s.currentBet === amount && s.config.baseBet === amount) return s;
      return { ...s, currentBet: amount, config: { ...s.config, baseBet: amount } };
    });
  }, [amount, autoRunning]);

  useEffect(() => {
    if (!autoRunning || !lastOutcome || !autoState) return;
    if (lastOutcome.nonce === lastNonceRef.current) return;
    lastNonceRef.current = lastOutcome.nonce;
    const next = autoStep(autoState, {
      outcome: lastOutcome.outcome,
      delta: lastOutcome.profit,
    });
    setAutoState(next);
    if (!next.running) setAutoRunning(false);
  }, [lastOutcome, autoRunning, autoState]);

  useEffect(() => {
    const prev = prevCanPlaceRef.current;
    prevCanPlaceRef.current = canPlace;
    if (!autoRunning || !autoState || !autoState.running) return;
    if (hasActiveBet || placingAutoRef.current) return;
    const phaseKey = bettingRoundKey ?? lastOutcome?.nonce ?? -1;
    if (!canPlace) return;
    const justOpened = !prev && canPlace;
    const firstStart = placedNonceRef.current === null;
    if (!justOpened && !firstStart) return;
    if (placedNonceRef.current === phaseKey && !firstStart) return;
    const bet = Math.min(autoState.currentBet, balance);
    if (bet <= 0) {
      setAutoRunning(false);
      return;
    }
    placingAutoRef.current = true;
    placedNonceRef.current = phaseKey;
    void (async () => {
      try {
        const result = onPlace(bet, target);
        const ok = result instanceof Promise ? await result : true;
        if (ok === false) placedNonceRef.current = null;
      } finally {
        placingAutoRef.current = false;
      }
    })();
  }, [
    autoRunning,
    autoState,
    canPlace,
    hasActiveBet,
    balance,
    bettingRoundKey,
    lastOutcome,
    onPlace,
    target,
  ]);

  function startAuto() {
    const s = initAutoBet({ ...cfg, baseBet: amount });
    setAutoState(s);
    lastNonceRef.current = null;
    placedNonceRef.current = null;
    setAutoRunning(true);
  }

  function stopAuto() {
    setAutoRunning(false);
    placedNonceRef.current = null;
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

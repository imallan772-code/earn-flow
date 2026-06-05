import { useCallback, useRef, useState, type RefObject } from "react";
import { PlinkoEngine, MULTIPLIERS, type RiskLevel, type RowCount } from "./PlinkoEngine";
import { getPlinkoSFX } from "./PlinkoSFX";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { profitOf, payoutOf } from "@/shared/games/engine/houseEdge";
import { plinkoStore, type PlinkoOutcome } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import type { GameMode } from "@/shared/mode/ModeContext";

export type PlinkoPhase = "idle" | "rolling" | "settled";

export function usePlinkoRound(
  mode: GameMode,
  engineRef: RefObject<PlinkoEngine | null>,
  playDrop: (
    result: ReturnType<PlinkoEngine["dropPath"]>,
    onLand: (slot: number, multiplier: number) => void,
  ) => void,
  onOutcome?: (o: { outcome: "win" | "loss"; profit: number; nonce: number }) => void,
) {
  const { balance, tryDebit, credit } = useGameWallet();
  const [phase, setPhase] = useState<PlinkoPhase>("idle");
  const [jackpot, setJackpot] = useState<PlinkoOutcome | null>(null);
  const placingRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jackpotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nonce = plinkoStore.use((s) => s.nonce);
  const rows = plinkoStore.use((s) => s.rows);
  const risk = plinkoStore.use((s) => s.risk);
  const lastOutcome = plinkoStore.use((s) => s.lastOutcome);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (placingRef.current || phase !== "idle" || amount <= 0) return;
      if (!engineRef.current) return;

      const roundId = `plinko-n${nonce}`;
      const ok = await tryDebit(amount, { game: "plinko", roundId });
      if (!ok) return;

      placingRef.current = true;
      const sfx = getPlinkoSFX();
      sfx.resume();
      sfx.ballRelease();

      plinkoStore.set((s) => ({ ...s, pendingAmount: amount }));
      setPhase("rolling");

      const seed = `phonara-plinko-${nonce}`;
      const result = engineRef.current.dropPath(seed, rows, risk);

      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "plinko",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });

      playDrop(result, (slot, multiplier) => {
        const payout = payoutOf(amount, multiplier, mode);
        const profit = profitOf(amount, multiplier, mode);
        const won = profit >= 0;

        void credit(payout, multiplier, { game: "plinko", roundId });

        const max = Math.max(...MULTIPLIERS[risk][rows]);
        const isJackpot = multiplier >= max * 0.5 && multiplier >= 5;
        const outcomePayload: PlinkoOutcome = {
          outcome: won ? "win" : "loss",
          profit,
          multiplier,
          bet: amount,
          payout,
          nonce,
          jackpot: isJackpot,
        };

        plinkoStore.set((s) => ({
          ...s,
          history: [{ id: `n${nonce}-${slot}`, multiplier, slot }, ...s.history].slice(0, 30),
          lastOutcome: outcomePayload,
        }));
        onOutcome?.({ outcome: outcomePayload.outcome, profit, nonce });

        sfx.landSound(multiplier, max);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(isJackpot ? [50, 30, 80] : won ? [30] : [12]);
          } catch {
            /* noop */
          }
        }

        if (isJackpot) {
          setJackpot(outcomePayload);
          if (jackpotTimerRef.current) clearTimeout(jackpotTimerRef.current);
          jackpotTimerRef.current = setTimeout(() => setJackpot(null), 2200);
        }

        liveBetsStore.update(liveBetId, {
          multiplier: won ? multiplier : null,
          profit: +profit.toFixed(2),
          status: won ? "win" : "loss",
        });

        setPhase("settled");
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
          setPhase("idle");
          plinkoStore.set((s) => ({ ...s, nonce: s.nonce + 1 }));
          settleTimerRef.current = null;
          placingRef.current = false;
        }, 800);
      });
    },
    [phase, nonce, rows, risk, mode, onOutcome, tryDebit, credit, engineRef, playDrop],
  );

  return {
    phase,
    jackpot,
    setJackpot,
    lastOutcome,
    nonce,
    rows,
    risk,
    balance,
    handlePlace,
    canPlace: phase === "idle",
  };
}

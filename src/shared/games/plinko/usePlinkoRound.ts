/**
 * usePlinkoRound — Plinko 라운드 + Wallet + LiveFeed 통합 훅 (ROUND M).
 *
 * 변경: 단일 라운드 → 5공 큐 (연타). Export 시그니처는 **git diff 0** 으로 동결.
 *
 * Money 정책 (Plinko-specific, L-2 inheritance):
 *  - PF block: 큐 가득 (5공 / reduced-motion 시 1공) → enqueue 무시
 *  - Real unmount: 새 enqueue 차단 + in-flight 정산 완료까지 drain.
 *    refund RPC 호출 0 — Plinko 1공 ~800ms, idempotency 의미 없음 (Dice/Wheel block-only).
 *  - useUnmountRefund 미장착 (long-round 전용 hook).
 *
 * 동시성:
 *  - 렌더러는 한 번에 한 공만 표시. 큐는 sequential drain.
 *  - nonce++ 는 **enqueue 시점** — debit roundId (`plinko-n${nonce}`) 와 1:1.
 *  - reducedMotion ON → 큐 cap=1 (단일 공만 낙하).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { PlinkoEngine, MULTIPLIERS, type RiskLevel, type RowCount } from "./PlinkoEngine";
import { getPlinkoSFX } from "./PlinkoSFX";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import { profitOf, payoutOf } from "@/shared/games/engine/houseEdge";
import { plinkoStore, type PlinkoOutcome } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import type { GameMode } from "@/shared/mode/ModeContext";

export type PlinkoPhase = "idle" | "rolling" | "settled";

const QUEUE_MAX = 5;
const SETTLE_MS = 800;
const JACKPOT_HOLD_MS = 2200;

interface QueueItem {
  nonce: number;
  amount: number;
  roundId: string;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

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
  const [queueSize, setQueueSize] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  const queueRef = useRef<QueueItem[]>([]);
  const inFlightRef = useRef(false);
  const unmountedRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jackpotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nonce = plinkoStore.use((s) => s.nonce);
  const rows = plinkoStore.use((s) => s.rows);
  const risk = plinkoStore.use((s) => s.risk);
  const lastOutcome = plinkoStore.use((s) => s.lastOutcome);

  // Snapshot refs so in-flight callbacks use the values at enqueue/drain time.
  const modeRef = useRef(mode);
  const rowsRef = useRef(rows);
  const riskRef = useRef(risk);
  const onOutcomeRef = useRef(onOutcome);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => {
    riskRef.current = risk;
  }, [risk]);
  useEffect(() => {
    onOutcomeRef.current = onOutcome;
  }, [onOutcome]);

  const refreshQueueSize = useCallback(() => {
    setQueueSize(queueRef.current.length + (inFlightRef.current ? 1 : 0));
  }, []);

  const drain = useCallback(() => {
    if (inFlightRef.current) return;
    const next = queueRef.current.shift();
    refreshQueueSize();
    if (!next) {
      setPhase("idle");
      return;
    }
    if (!engineRef.current) {
      // Engine vanished mid-drain (e.g. unmount race). Best-effort: discard.
      // No refund per Plinko money policy.
      inFlightRef.current = false;
      refreshQueueSize();
      return;
    }

    inFlightRef.current = true;
    setPhase("rolling");

    const sfx = getPlinkoSFX();
    sfx.resume();
    sfx.ballRelease();

    const curMode = modeRef.current;
    const curRows = rowsRef.current;
    const curRisk = riskRef.current;
    const seed = `phonara-plinko-${next.nonce}`;
    const result = engineRef.current.dropPath(seed, curRows, curRisk);

    const liveBetId = liveBetsStore.push({
      user: "나의_베팅",
      game: "plinko",
      amount: next.amount,
      multiplier: null,
      profit: null,
      status: "pending",
      mode: curMode,
      isMe: true,
    });

    let settled = false;
    const finishDrop = (slot: number, multiplier: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimer);

      const payout = payoutOf(next.amount, multiplier, curMode);
      const profit = profitOf(next.amount, multiplier, curMode);
      const won = profit >= 0;

      void credit(payout, multiplier, { game: "plinko", roundId: next.roundId });

      const max = Math.max(...MULTIPLIERS[curRisk][curRows]);
      const isJackpot = multiplier >= max * 0.5 && multiplier >= 5;
      const outcomePayload: PlinkoOutcome = {
        outcome: won ? "win" : "loss",
        profit,
        multiplier,
        bet: next.amount,
        payout,
        nonce: next.nonce,
        jackpot: isJackpot,
      };

      plinkoStore.set((s) => ({
        ...s,
        history: [{ id: `n${next.nonce}-${slot}`, multiplier, slot }, ...s.history].slice(0, 30),
        lastOutcome: outcomePayload,
      }));
      onOutcomeRef.current?.({ outcome: outcomePayload.outcome, profit, nonce: next.nonce });

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
        jackpotTimerRef.current = setTimeout(() => setJackpot(null), JACKPOT_HOLD_MS);
      }

      liveBetsStore.settle(
        liveBetId,
        {
          multiplier: won ? multiplier : null,
          profit: +profit.toFixed(2),
          status: won ? "win" : "loss",
        },
        userLiveBetFallback("plinko", next.amount, curMode),
      );

      setPhase("settled");
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        inFlightRef.current = false;
        refreshQueueSize();
        if (queueRef.current.length > 0) {
          drain();
        } else {
          setPhase("idle");
        }
      }, SETTLE_MS);
    };

    // Safety: if canvas/renderer never calls onLand (HMR, zero-size canvas), still settle.
    const fallbackTimer = setTimeout(() => {
      finishDrop(result.finalSlot, result.multiplier);
    }, SETTLE_MS + 700);

    playDrop(result, finishDrop);
  }, [engineRef, playDrop, credit, refreshQueueSize]);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (amount <= 0) return;
      if (unmountedRef.current) return;
      const cap = reducedMotion ? 1 : QUEUE_MAX;
      if (queueRef.current.length + (inFlightRef.current ? 1 : 0) >= cap) return;
      if (!engineRef.current) return;

      // Enqueue-time nonce: 1:1 with debit roundId.
      const enqueueNonce = plinkoStore.get().nonce;
      const roundId = `plinko-n${enqueueNonce}`;
      const ok = await tryDebit(amount, { game: "plinko", roundId });
      if (!ok) return;
      // Real unmount mid-debit: money is gone (matches policy — no refund RPC on Plinko).
      if (unmountedRef.current) return;

      queueRef.current.push({ nonce: enqueueNonce, amount, roundId });
      plinkoStore.set((s) => ({ ...s, nonce: s.nonce + 1, pendingAmount: amount }));
      refreshQueueSize();
      drain();
    },
    [reducedMotion, tryDebit, engineRef, refreshQueueSize, drain],
  );

  // AC-M-4: real unmount → block new enqueue, let in-flight drain naturally, no refund RPC.
  // demo unmount → same (no balance impact since demo wallet is local cache).
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (jackpotTimerRef.current) {
        clearTimeout(jackpotTimerRef.current);
        jackpotTimerRef.current = null;
      }
      // Do NOT clear queueRef / settleTimerRef — in-flight callbacks must complete.
    };
  }, []);

  const cap = reducedMotion ? 1 : QUEUE_MAX;
  const canPlace = queueSize < cap;

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
    canPlace,
  };
}

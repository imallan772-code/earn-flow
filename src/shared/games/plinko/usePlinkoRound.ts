/**
 * usePlinkoRound — Plinko 라운드 + Wallet + LiveFeed (GA-I server queue).
 *
 * Server path (GA-I): plinko_enqueue_v1 → physics anim → plinko_complete_v1 credit.
 * Legacy path: mulberry32 dropPath (flag off / offline).
 *
 * Export 시그니처 동결. Resume-First: plinko_list_pending_v1 on mount.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  PlinkoEngine,
  MULTIPLIERS,
  type PlinkoDropResult,
  type RiskLevel,
  type RowCount,
} from "./PlinkoEngine";
import { getPlinkoSFX } from "./PlinkoSFX";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import { liveFeedBetIdForRound } from "@/lib/api/liveFeedMap";
import { settlementPayout, settlementProfit } from "@/shared/games/engine/houseEdge";
import { plinkoStore, type PlinkoOutcome } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import type { GameMode } from "@/shared/mode/ModeContext";
import { clearRealSession, syncRealSession } from "@/shared/games/gameSessionHelpers";
import { useAuth } from "@/features/auth/AuthContext";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { usePfSession } from "@/shared/games/hooks/usePfSession";
import { useGameAuthorityFlag } from "@/shared/games/hooks/useGameAuthorityFlag";
import {
  isPlinkoEnqueueConflict,
  plinkoComplete,
  plinkoEnqueue,
  plinkoListPending,
  resolvePlinkoEnqueueNonce,
} from "@/lib/api/plinkoSession";
import { toIntegerPhonAmount } from "@/lib/api/walletSchemas";
import { syncRealBalance } from "@/shared/wallet/walletStore";
import { appToast } from "@/shared/ui/toast";

export type PlinkoPhase = "idle" | "rolling" | "settled";

const QUEUE_MAX = 5;
const SETTLE_MS = 800;
const JACKPOT_HOLD_MS = 2200;
const LEGACY_PF_SEED = "phonara-plinko-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";

interface QueueItem {
  nonce: number;
  amount: number;
  roundId: string;
  serverSide?: boolean;
  path?: number[];
  finalSlot?: number;
  multiplier?: number;
  rows?: RowCount;
  risk?: RiskLevel;
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
    result: PlinkoDropResult,
    onLand: (slot: number, multiplier: number) => void,
  ) => void,
  onOutcome?: (o: { outcome: "win" | "loss"; profit: number; nonce: number }) => void,
) {
  const { status: authStatus } = useAuth();
  const { balance, tryDebit, credit } = useGameWallet();
  const pf = usePfSession("plinko", LEGACY_PF_SEED, DEFAULT_CLIENT_SEED);
  const plinkoServerFlag = useGameAuthorityFlag("plinko_server_settle");
  const canUseServerAuthority =
    isSupabaseConfigured() &&
    authStatus === "authenticated" &&
    pf.ready &&
    !pf.legacyFallback &&
    plinkoServerFlag;

  const [phase, setPhase] = useState<PlinkoPhase>("idle");
  const [jackpot, setJackpot] = useState<PlinkoOutcome | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  const queueRef = useRef<QueueItem[]>([]);
  const inFlightRef = useRef(false);
  const unmountedRef = useRef(false);
  const restoredRef = useRef(false);
  const placeInFlightRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jackpotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nonce = plinkoStore.use((s) => s.nonce);
  const rows = plinkoStore.use((s) => s.rows);
  const risk = plinkoStore.use((s) => s.risk);
  const lastOutcome = plinkoStore.use((s) => s.lastOutcome);

  const modeRef = useRef(mode);
  const rowsRef = useRef(rows);
  const riskRef = useRef(risk);
  const onOutcomeRef = useRef(onOutcome);
  const canUseServerRef = useRef(canUseServerAuthority);
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
  useEffect(() => {
    canUseServerRef.current = canUseServerAuthority;
  }, [canUseServerAuthority]);

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
    const curRows = (next.rows ?? rowsRef.current) as RowCount;
    const curRisk = (next.risk ?? riskRef.current) as RiskLevel;

    let result: PlinkoDropResult;
    if (next.serverSide && next.path && next.finalSlot != null && next.multiplier != null) {
      result = {
        path: next.path,
        finalSlot: next.finalSlot,
        multiplier: next.multiplier,
        totalRows: curRows,
        risk: curRisk,
        seed: `pf-n${next.nonce}`,
      };
    } else {
      const seed = `phonara-plinko-${next.nonce}`;
      result = engineRef.current.dropPath(seed, curRows, curRisk);
    }

    const liveBetId = liveBetsStore.push({
      id: liveFeedBetIdForRound("plinko", next.roundId),
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

      const table = MULTIPLIERS[curRisk][curRows];
      const engineMult = table[slot];
      if (engineMult === undefined || engineMult !== multiplier) {
        multiplier = engineMult ?? multiplier;
      }

      const payout = settlementPayout(next.amount, multiplier, curMode);
      const profit = settlementProfit(next.amount, multiplier, curMode);
      const won = profit >= 0;
      const skipClientCredit = next.serverSide && curMode === "real";

      if (payout > 0 && !skipClientCredit) {
        void credit(payout, multiplier, { game: "plinko", roundId: next.roundId });
      }

      if (next.serverSide) {
        void plinkoComplete(next.roundId)
          .then((res) => {
            if (res.balance?.phon != null) syncRealBalance(res.balance.phon);
          })
          .catch(() => {
            /* E2E/resume may race duplicate complete — server is idempotent when settled */
          });
      } else if (curMode === "real") {
        clearRealSession("plinko", next.roundId);
      }

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

    const fallbackTimer = setTimeout(() => {
      finishDrop(result.finalSlot, result.multiplier);
    }, SETTLE_MS + 700);

    playDrop(result, finishDrop);
  }, [engineRef, playDrop, credit, refreshQueueSize]);

  // Resume-First: hydrate pending server queue (GA-I §5.4).
  useEffect(() => {
    if (restoredRef.current || !canUseServerAuthority) return;
    restoredRef.current = true;
    void plinkoListPending()
      .then((items) => {
        if (items.length === 0) return;
        for (const item of items) {
          queueRef.current.push({
            nonce: item.nonce,
            amount: item.stake_amount > 0 ? item.stake_amount : plinkoStore.get().pendingAmount,
            roundId: item.round_id,
            serverSide: true,
            path: item.path,
            finalSlot: item.final_slot,
            multiplier: item.multiplier,
            rows: item.rows,
            risk: item.risk,
          });
        }
        refreshQueueSize();
        drain();
      })
      .catch(() => {
        /* local-only fallback */
      });
  }, [canUseServerAuthority, drain, refreshQueueSize]);

  const handlePlace = useCallback(
    async (amount: number): Promise<boolean> => {
      if (amount <= 0) return false;
      if (unmountedRef.current) return false;
      const cap = reducedMotion ? 1 : QUEUE_MAX;
      if (queueRef.current.length + (inFlightRef.current ? 1 : 0) >= cap) return false;
      if (!engineRef.current) return false;

      const syncedNonce = canUseServerRef.current
        ? await resolvePlinkoEnqueueNonce(plinkoStore.get().nonce)
        : plinkoStore.get().nonce;
      if (syncedNonce !== plinkoStore.get().nonce) {
        plinkoStore.set((s) => ({ ...s, nonce: syncedNonce }));
      }

      const enqueueNonce = syncedNonce;
      const roundId = `plinko-n${enqueueNonce}`;
      const curRows = rowsRef.current;
      const curRisk = riskRef.current;

      if (canUseServerRef.current) {
        if (placeInFlightRef.current) return false;
        placeInFlightRef.current = true;
        const betAmount =
          modeRef.current === "real"
            ? toIntegerPhonAmount(amount)
            : Math.max(1, Math.round(amount));
        if (modeRef.current === "real" && betAmount == null) {
          placeInFlightRef.current = false;
          return false;
        }

        try {
          if (modeRef.current === "demo") {
            const ok = await tryDebit(amount, { game: "plinko", roundId });
            if (!ok) return false;
          }
          if (unmountedRef.current) return false;

          const res = await plinkoEnqueue({
            amount: betAmount ?? Math.max(1, Math.round(amount)),
            roundId,
            rows: curRows,
            risk: curRisk,
            clientSeed: DEFAULT_CLIENT_SEED,
          });
          if (res.mode === "real" && res.balance?.phon != null) {
            syncRealBalance(res.balance.phon);
          }

          queueRef.current.push({
            nonce: enqueueNonce,
            amount: modeRef.current === "demo" ? amount : (betAmount ?? amount),
            roundId,
            serverSide: true,
            path: res.path,
            finalSlot: res.final_slot,
            multiplier: res.multiplier,
            rows: res.rows,
            risk: res.risk,
          });
          plinkoStore.set((s) => ({
            ...s,
            nonce: enqueueNonce + 1,
            pendingAmount: amount,
          }));
          refreshQueueSize();
          drain();
          return true;
        } catch (err) {
          if (isPlinkoEnqueueConflict(err)) {
            const msg =
              err && typeof err === "object"
                ? `${(err as { message?: string }).message ?? ""}`
                : "";
            if (msg.includes("PLINKO_ROUND_ALREADY_COMPLETED")) {
              plinkoStore.set((s) => ({ ...s, nonce: enqueueNonce + 1 }));
              placeInFlightRef.current = false;
              return true;
            }
            try {
              const pending = await plinkoListPending();
              const row = pending.find((p) => p.round_id === roundId);
              if (row) {
                queueRef.current.push({
                  nonce: row.nonce,
                  amount: row.stake_amount > 0 ? row.stake_amount : amount,
                  roundId: row.round_id,
                  serverSide: true,
                  path: row.path,
                  finalSlot: row.final_slot,
                  multiplier: row.multiplier,
                  rows: row.rows,
                  risk: row.risk,
                });
                refreshQueueSize();
                drain();
                return true;
              }
            } catch {
              /* fall through */
            }
          }
          appToast.raw.error("베팅에 실패했습니다 (네트워크 오류)");
          return false;
        } finally {
          placeInFlightRef.current = false;
        }
      }

      const ok = await tryDebit(amount, { game: "plinko", roundId });
      if (!ok) return false;
      if (unmountedRef.current) return false;

      if (modeRef.current === "real") {
        syncRealSession("plinko", roundId, amount, {
          nonce: enqueueNonce,
          amount,
          rows: curRows,
          risk: curRisk,
        });
      }

      queueRef.current.push({ nonce: enqueueNonce, amount, roundId });
      plinkoStore.set((s) => ({ ...s, nonce: s.nonce + 1, pendingAmount: amount }));
      refreshQueueSize();
      drain();
      return true;
    },
    [reducedMotion, tryDebit, engineRef, refreshQueueSize, drain],
  );

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (jackpotTimerRef.current) {
        clearTimeout(jackpotTimerRef.current);
        jackpotTimerRef.current = null;
      }
    };
  }, []);

  const cap = reducedMotion ? 1 : QUEUE_MAX;
  const canPlace = queueSize < cap && pf.ready;
  const autoCanPlace = phase === "idle" && queueSize === 0;

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
    autoCanPlace,
  };
}

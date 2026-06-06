/**
 * useMinesLifecycle — Mines 라운드 전체 lifecycle (place/reveal/cashout/random + 복원/정리).
 *
 * 본 훅은 useGameRound·useGameWallet·minesStore와 직접 통신하며 다음을 단일 SSOT로 제공:
 *  - active / revealed / hitTile / shakeKey / flashKey / recent
 *  - handlePlace / handleReveal / handleCashout / handleRandomPick
 *
 * 불변식 (ROUND H 보존)
 *  - handlePlace / tryDebit / liveBetsStore.push 재호출 금지 (이중 차감 방지)
 *  - 새로고침 mid-round 복원 시 round.place()만 호출, debit 추가 없음
 *  - useUnmountRefund — mid-round bet 환수 (Screen 측에서 등록)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { profitOf } from "@/shared/games/engine/houseEdge";
import {
  TOTAL_TILES,
  isMine,
  nextMultiplier,
  placeMines,
} from "@/shared/games/mines/MinesEngine";
import { type ActiveMinesRound, minesStore } from "@/shared/games/state/persistedGameState";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";

interface ActiveBet {
  amount: number;
  mineCount: number;
  mines: number[];
  liveBetId: string;
  nonce: number;
}

export interface RecentResult {
  outcome: "win" | "loss";
  profit: number;
  mult: number;
  nonce: number;
  mineCount: number;
  revealed: number;
}

interface RoundLike {
  phase: string;
  isIdle: boolean;
  place: () => void;
  settle: () => void;
}

interface WalletLike {
  mode: string;
  tryDebit: (amount: number, meta: { game: string; roundId: string }) => Promise<boolean>;
  credit: (amount: number, mult: number, meta: { game: string; roundId: string }) => Promise<unknown> | unknown;
}

interface Args {
  round: RoundLike;
  wallet: WalletLike;
  nonce: number;
  mineCount: number;
  serverSeed: string;
  defaultClientSeed: string;
}

function vibrate(ms: number) {
  if (typeof navigator === "undefined") return;
  navigator.vibrate?.(ms);
}

export function useMinesLifecycle({
  round,
  wallet,
  nonce,
  mineCount,
  serverSeed,
  defaultClientSeed,
}: Args) {
  const sfx = useSfx();
  const [active, setActive] = useState<ActiveBet | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [hitTile, setHitTile] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [recent, setRecent] = useState<RecentResult | null>(null);
  const settledRef = useRef(false);
  const restoredRef = useRef(false);

  // Restore active round (1회) — handlePlace 재호출 금지
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const ar = minesStore.get().activeRound;
    if (!ar) return;
    setActive({
      amount: ar.amount,
      mineCount: ar.mineCount,
      mines: ar.mines,
      liveBetId: ar.liveBetId,
      nonce: ar.nonce,
    });
    setRevealed(ar.revealed);
    setHitTile(null);
    round.place();
  }, [round]);

  // settled → cleanup + nonce++
  useEffect(() => {
    if (round.phase !== "idle") return;
    if (!settledRef.current) return;
    settledRef.current = false;
    setActive(null);
    setRevealed([]);
    setHitTile(null);
    minesStore.set((s) => ({ ...s, nonce: s.nonce + 1, activeRound: null }));
  }, [round.phase]);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (!round.isIdle || amount <= 0) return;
      const ok = await wallet.tryDebit(amount, { game: "mines", roundId: `n${nonce}` });
      if (!ok) return;
      minesStore.set((s) => ({ ...s, pendingAmount: amount }));
      const seed = minesStore.get().clientSeed || defaultClientSeed;
      const mines = await placeMines({ serverSeed, clientSeed: seed, nonce }, mineCount);
      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "mines",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode: wallet.mode as never,
        isMe: true,
      });
      const activeRound: ActiveMinesRound = {
        nonce,
        amount,
        mineCount,
        mines,
        revealed: [],
        liveBetId,
        placedAt: Date.now(),
      };
      minesStore.set((s) => ({ ...s, activeRound }));
      setActive({ amount, mineCount, mines, liveBetId, nonce });
      setRevealed([]);
      setHitTile(null);
      round.place();
      sfx.play("bet");
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [round, wallet, mineCount, nonce, serverSeed, defaultClientSeed, sfx],
  );

  const handleReveal = useCallback(
    (tile: number) => {
      if (round.phase !== "playing" || !active) return;
      if (revealed.includes(tile) || hitTile != null) return;
      if (isMine(tile, active.mines)) {
        setHitTile(tile);
        setShakeKey((k) => k + 1);
        setFlashKey((k) => k + 1);
        vibrate(40);
        const mult = nextMultiplier(revealed.length, active.mineCount);
        liveBetsStore.update(active.liveBetId, {
          multiplier: null,
          profit: -active.amount,
          status: "loss",
        });
        minesStore.set((s) => ({
          ...s,
          activeRound: null,
          history: [
            {
              id: `n${active.nonce}`,
              mineCount: active.mineCount,
              revealed: revealed.length,
              multiplier: mult,
              win: false,
            },
            ...s.history,
          ].slice(0, 30),
          lastOutcome: {
            outcome: "loss",
            profit: -active.amount,
            nonce: active.nonce,
            mineCount: active.mineCount,
            revealed: revealed.length,
            multiplier: mult,
          },
        }));
        recordSessionOutcome({ outcome: "loss", profit: -active.amount });
        sfx.play("loss");
        appToast.game.lose({ amount: formatPHON(active.amount) });
        setRecent({
          outcome: "loss",
          profit: -active.amount,
          mult,
          nonce: active.nonce,
          mineCount: active.mineCount,
          revealed: revealed.length,
        });
        settledRef.current = true;
        round.settle();
        return;
      }
      const nextRevealed = [...revealed, tile];
      setRevealed(nextRevealed);
      vibrate(8);
      sfx.play("peg");
      minesStore.set((s) =>
        s.activeRound ? { ...s, activeRound: { ...s.activeRound, revealed: nextRevealed } } : s,
      );
    },
    [round, active, revealed, hitTile, sfx],
  );

  const currentMult = nextMultiplier(revealed.length, active?.mineCount ?? mineCount);

  const handleCashout = useCallback(() => {
    if (round.phase !== "playing" || !active || revealed.length === 0 || hitTile != null) return;
    const profit = profitOf(active.amount, currentMult, wallet.mode as never);
    void wallet.credit(active.amount + profit, currentMult, {
      game: "mines",
      roundId: `n${active.nonce}`,
    });
    liveBetsStore.update(active.liveBetId, {
      multiplier: currentMult,
      profit: +profit.toFixed(2),
      status: "cashout",
    });
    minesStore.set((s) => ({
      ...s,
      activeRound: null,
      history: [
        {
          id: `n${active.nonce}`,
          mineCount: active.mineCount,
          revealed: revealed.length,
          multiplier: currentMult,
          win: true,
        },
        ...s.history,
      ].slice(0, 30),
      lastOutcome: {
        outcome: "win",
        profit,
        nonce: active.nonce,
        mineCount: active.mineCount,
        revealed: revealed.length,
        multiplier: currentMult,
      },
    }));
    recordSessionOutcome({ outcome: "win", profit, multiplier: currentMult });
    sfx.play("cashout");
    if (currentMult >= 10) sfx.play("jackpot");
    appToast.game.cashout({ mult: currentMult.toFixed(2), amount: formatPHON(profit) });
    setRecent({
      outcome: "win",
      profit,
      mult: currentMult,
      nonce: active.nonce,
      mineCount: active.mineCount,
      revealed: revealed.length,
    });
    settledRef.current = true;
    round.settle();
  }, [round, active, revealed, hitTile, currentMult, wallet, sfx]);

  const randomLockRef = useRef(false);
  const handleRandomPick = useCallback(() => {
    if (round.phase !== "playing" || !active || hitTile != null) return;
    if (randomLockRef.current) return;
    randomLockRef.current = true;
    setTimeout(() => {
      randomLockRef.current = false;
    }, 200);
    const candidates: number[] = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      if (!revealed.includes(i) && !active.mines.includes(i)) candidates.push(i);
    }
    if (candidates.length === 0) {
      for (let i = 0; i < TOTAL_TILES; i++) {
        if (!revealed.includes(i)) candidates.push(i);
      }
    }
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    handleReveal(pick);
  }, [round.phase, active, revealed, hitTile, handleReveal]);

  // Reset internal state for PF seed change (called from Screen)
  const resetForSeedChange = useCallback(() => {
    setActive(null);
    setRevealed([]);
    setHitTile(null);
    settledRef.current = false;
  }, []);

  const nextSafeChance = useMemo(() => {
    const M = active?.mineCount ?? mineCount;
    const r = revealed.length;
    const denom = TOTAL_TILES - r;
    if (denom <= 0) return 0;
    return Math.max(0, (TOTAL_TILES - M - r) / denom);
  }, [active, mineCount, revealed]);

  const nextMultPreview = useMemo(
    () => nextMultiplier(revealed.length + 1, active?.mineCount ?? mineCount),
    [active, mineCount, revealed],
  );

  return {
    active,
    revealed,
    hitTile,
    shakeKey,
    flashKey,
    recent,
    setRecent,
    currentMult,
    nextSafeChance,
    nextMultPreview,
    sfx,
    handlePlace,
    handleReveal,
    handleCashout,
    handleRandomPick,
    resetForSeedChange,
  };
}

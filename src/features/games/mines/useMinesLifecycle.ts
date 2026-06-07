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
 *  - useUnmountRefund 미장착 — mid-round 이탈 시 activeRound resume (Stake-like)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import { liveFeedBetIdForRound } from "@/lib/api/liveFeedMap";
import { profitOf } from "@/shared/games/engine/houseEdge";
import { TOTAL_TILES, isMine, nextMultiplier, placeMines } from "@/shared/games/mines/MinesEngine";
import { type ActiveMinesRound, minesStore } from "@/shared/games/state/persistedGameState";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";
import { cashoutMinesRound, revealMinesTile, startMinesRound } from "@/lib/api/minesSession";
import { clearGameActiveSession, getGameActiveSession } from "@/lib/api/gameSessions";
import {
  activeMinesRoundFromSession,
  isMinesSessionConflict,
} from "@/lib/gameSessions/minesSessionUtils";
import { toIntegerPhonAmount } from "@/lib/api/walletSchemas";
import { syncRealBalance } from "@/shared/wallet/walletStore";

interface ActiveBet {
  amount: number;
  mineCount: number;
  mines: number[];
  liveBetId: string;
  nonce: number;
  serverSide?: boolean;
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
  credit: (
    amount: number,
    mult: number,
    meta: { game: string; roundId: string },
  ) => Promise<unknown> | unknown;
}

interface Args {
  round: RoundLike;
  wallet: WalletLike;
  nonce: number;
  mineCount: number;
  serverSeed: string;
  pfReady: boolean;
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
  pfReady,
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
  const restoreReadyRef = useRef(wallet.mode !== "real");
  const placeInFlightRef = useRef(false);

  const commitActiveRound = useCallback(
    (ar: ActiveMinesRound, opts?: { resumed?: boolean }) => {
      minesStore.set((s) => ({ ...s, activeRound: ar, pendingAmount: ar.amount }));
      setActive({
        amount: ar.amount,
        mineCount: ar.mineCount,
        mines: ar.mines,
        liveBetId: ar.liveBetId,
        nonce: ar.nonce,
        serverSide: ar.serverSide,
      });
      setRevealed(ar.revealed);
      setHitTile(null);
      liveBetsStore.ensureUserPending({
        id: ar.liveBetId,
        user: "나의_베팅",
        game: "mines",
        amount: ar.amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode: wallet.mode as never,
        isMe: true,
      });
      round.place();
      if (opts?.resumed) {
        appToast.raw.info("진행 중인 Mines 라운드를 이어갑니다");
      }
    },
    [round, wallet.mode],
  );

  const hydrateActiveRound = useCallback(
    (ar: ActiveMinesRound, opts?: { resumed?: boolean }) => {
      if (!ar.betMode) {
        minesStore.set((s) =>
          s.activeRound
            ? { ...s, activeRound: { ...s.activeRound, betMode: wallet.mode as "demo" | "real" } }
            : s,
        );
      }
      commitActiveRound({ ...ar, betMode: ar.betMode ?? (wallet.mode as "demo" | "real") }, opts);
    },
    [commitActiveRound, wallet.mode],
  );

  // Restore active round (1회) — real: server SSOT, demo: localStorage
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (wallet.mode === "real") {
      void getGameActiveSession("mines")
        .then((row) => {
          if (row) {
            const local = minesStore.get().activeRound;
            const ar = activeMinesRoundFromSession(row, mineCount, local?.liveBetId);
            hydrateActiveRound(ar, { resumed: true });
            return;
          }
          const ar = minesStore.get().activeRound;
          if (ar) hydrateActiveRound(ar);
        })
        .catch(() => {
          const ar = minesStore.get().activeRound;
          if (ar) hydrateActiveRound(ar);
        })
        .finally(() => {
          restoreReadyRef.current = true;
        });
      return;
    }

    restoreReadyRef.current = true;

    const ar = minesStore.get().activeRound;
    if (ar) hydrateActiveRound(ar);
  }, [hydrateActiveRound, wallet.mode, mineCount]);

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
    async (amount: number): Promise<boolean> => {
      if (!round.isIdle || amount <= 0 || !pfReady || !serverSeed.trim()) return false;

      if (wallet.mode === "real") {
        if (!restoreReadyRef.current || placeInFlightRef.current) return false;
        placeInFlightRef.current = true;
        const roundId = `n${nonce}`;
        const seed = minesStore.get().clientSeed || defaultClientSeed;
        const betAmount = toIntegerPhonAmount(amount);
        if (betAmount == null) {
          placeInFlightRef.current = false;
          return false;
        }

        try {
          const existing = await getGameActiveSession("mines");
          if (existing) {
            const local = minesStore.get().activeRound;
            const ar = activeMinesRoundFromSession(existing, mineCount, local?.liveBetId);
            hydrateActiveRound(ar, { resumed: true });
            return true;
          }

          const liveBetId = liveBetsStore.push({
            id: liveFeedBetIdForRound("mines", roundId),
            user: "나의_베팅",
            game: "mines",
            amount: betAmount,
            multiplier: null,
            profit: null,
            status: "pending",
            mode: wallet.mode as never,
            isMe: true,
          });

          const res = await startMinesRound({
            amount: betAmount,
            roundId,
            mineCount,
            clientSeed: seed,
            nonce,
            serverSeed,
          });
          if (res.balance?.phon != null) syncRealBalance(res.balance.phon);

          const activeRound: ActiveMinesRound = {
            nonce,
            amount: res.bet_amount,
            mineCount: res.mine_count,
            mines: [],
            revealed: res.revealed,
            liveBetId,
            placedAt: Date.now(),
            betMode: "real",
            serverSide: true,
          };
          commitActiveRound(activeRound, { resumed: res.resumed });
          if (!res.resumed) {
            sfx.play("bet");
          }
          return true;
        } catch (err) {
          if (isMinesSessionConflict(err)) {
            try {
              const row = await getGameActiveSession("mines");
              if (row) {
                const local = minesStore.get().activeRound;
                const ar = activeMinesRoundFromSession(row, mineCount, local?.liveBetId);
                hydrateActiveRound(ar, { resumed: true });
                return true;
              }
            } catch {
              /* fall through */
            }
          }
          appToast.raw.error("베팅에 실패했습니다 (진행 중 라운드가 있거나 네트워크 오류)");
          return false;
        } finally {
          placeInFlightRef.current = false;
        }
      }

      const roundId = `n${nonce}`;
      const seed = minesStore.get().clientSeed || defaultClientSeed;
      const ok = await wallet.tryDebit(amount, { game: "mines", roundId });
      if (!ok) return false;
      const liveBetId = liveBetsStore.push({
        id: liveFeedBetIdForRound("mines", roundId),
        user: "나의_베팅",
        game: "mines",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode: wallet.mode as never,
        isMe: true,
      });
      minesStore.set((s) => ({ ...s, pendingAmount: amount }));
      const mines = await placeMines({ serverSeed, clientSeed: seed, nonce }, mineCount);
      const activeRound: ActiveMinesRound = {
        nonce,
        amount,
        mineCount,
        mines,
        revealed: [],
        liveBetId,
        placedAt: Date.now(),
        betMode: "demo",
      };
      minesStore.set((s) => ({ ...s, activeRound }));
      setActive({ amount, mineCount, mines, liveBetId, nonce });
      setRevealed([]);
      setHitTile(null);
      round.place();
      sfx.play("bet");
      return true;
    },
    [
      round,
      wallet,
      mineCount,
      nonce,
      serverSeed,
      pfReady,
      defaultClientSeed,
      sfx,
      commitActiveRound,
      hydrateActiveRound,
    ],
  );

  const handleReveal = useCallback(
    (tile: number) => {
      if (round.phase !== "playing" || !active) return;
      if (revealed.includes(tile) || hitTile != null) return;

      const finishLoss = (mines: number[], mult: number) => {
        setHitTile(tile);
        setShakeKey((k) => k + 1);
        setFlashKey((k) => k + 1);
        vibrate(40);
        if (active.serverSide) {
          setActive((prev) => (prev ? { ...prev, mines } : null));
          void clearGameActiveSession("mines", `n${active.nonce}`);
        }
        liveBetsStore.settle(
          active.liveBetId,
          { multiplier: null, profit: -active.amount, status: "loss" },
          userLiveBetFallback("mines", active.amount, wallet.mode as never),
        );
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
      };

      if (active.serverSide) {
        void revealMinesTile(`n${active.nonce}`, tile)
          .then((res) => {
            if (res.hit) {
              finishLoss(res.mines ?? [], res.multiplier);
              return;
            }
            const nextRevealed = res.revealed;
            setRevealed(nextRevealed);
            vibrate(8);
            sfx.play("peg");
            minesStore.set((s) =>
              s.activeRound
                ? { ...s, activeRound: { ...s.activeRound, revealed: nextRevealed } }
                : s,
            );
          })
          .catch(() => appToast.raw.error("타일 공개에 실패했습니다"));
        return;
      }

      if (isMine(tile, active.mines)) {
        finishLoss(active.mines, nextMultiplier(revealed.length, active.mineCount));
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
    [round, active, revealed, hitTile, sfx, wallet.mode],
  );

  const currentMult = nextMultiplier(revealed.length, active?.mineCount ?? mineCount);

  const handleCashout = useCallback(() => {
    if (round.phase !== "playing" || !active || revealed.length === 0 || hitTile != null) return;
    const profit = profitOf(active.amount, currentMult, wallet.mode as never);
    const gross = Math.round(active.amount + profit);

    const finishWin = () => {
      liveBetsStore.settle(
        active.liveBetId,
        {
          multiplier: currentMult,
          profit: +profit.toFixed(2),
          status: "cashout",
        },
        userLiveBetFallback("mines", active.amount, wallet.mode as never),
      );
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
    };

    if (active.serverSide) {
      void cashoutMinesRound(`n${active.nonce}`)
        .then((res) => {
          if (res.balance?.phon != null) syncRealBalance(res.balance.phon);
          finishWin();
        })
        .catch(() => appToast.raw.error("캐시아웃에 실패했습니다"));
      return;
    }

    void wallet.credit(gross, currentMult, {
      game: "mines",
      roundId: `n${active.nonce}`,
    });
    finishWin();
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
      if (revealed.includes(i)) continue;
      if (!active.serverSide && active.mines.includes(i)) continue;
      candidates.push(i);
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

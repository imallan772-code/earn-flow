/**
 * useUnmountRefund — SSOT for Crash/Mines/Limbo mid-round cancel on unmount.
 *
 * Fire-and-forget refund RPC with { game, roundId } meta (same roundId as debit).
 * Server-side refund_phon_for_bet_v2 is idempotent — safe under rapid mount/unmount.
 */
import { useEffect, useRef } from "react";
import { liveBetsStore, type LiveGame } from "@/shared/livefeed/LiveBetsStore";
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import type { GameWalletMeta } from "./useGameWallet";

type RefundFn = (amount: number, meta?: GameWalletMeta) => Promise<boolean>;

export interface PendingRefund {
  amount: number;
  meta: GameWalletMeta;
  /** When set, feed row is settled on unmount (refund path). */
  liveBetId?: string;
  mode?: "demo" | "real";
}

export function useUnmountRefund(refund: RefundFn, getPending: () => PendingRefund | null) {
  const refundRef = useRef(refund);
  const getRef = useRef(getPending);
  refundRef.current = refund;
  getRef.current = getPending;
  useEffect(() => {
    return () => {
      const p = getRef.current();
      if (!p || p.amount <= 0) return;
      if (p.liveBetId) {
        liveBetsStore.settle(
          p.liveBetId,
          { multiplier: null, profit: 0, status: "bust" },
          userLiveBetFallback(p.meta.game as LiveGame, p.amount, p.mode ?? "demo"),
        );
      }
      void refundRef.current(p.amount, p.meta).catch(() => undefined);
    };
  }, []);
}

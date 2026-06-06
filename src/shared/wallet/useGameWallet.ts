import { useCallback } from "react";
import { useBalance, wallet, useWalletStats, useIsDemoLow, syncRealBalance } from "./walletStore";
import { useMode, type GameMode } from "@/shared/mode/ModeContext";
import { useProfile } from "@/features/profile/useProfile";
import { useAuth } from "@/features/auth/AuthContext";
import { creditPhonForPayout, debitPhonForBet, refundPhonForBet } from "@/lib/api/wallet";
import { isBenignRefundError } from "@/lib/api/walletErrors";
import { toIntegerPhonAmount } from "@/lib/api/walletSchemas";
import { logGameRound } from "@/lib/api/trading";
import { appToast } from "@/shared/ui/toast";

export interface GameWalletMeta {
  game: string;
  roundId?: string;
  /** Mode at bet placement — refund uses this instead of current toggle when set. */
  betMode?: GameMode;
}

/**
 * Unified game wallet hook.
 * - demo: localStorage walletStore
 * - real: Supabase RPC (debit/credit/refund) + Realtime sync
 */
export function useGameWallet() {
  const { mode } = useMode();
  const { status, isConfigured } = useAuth();
  const { balance, isLoading: profileLoading } = useProfile();
  const demoBalance = useBalance("demo");
  const realBalance = useBalance("real");
  const stats = useWalletStats();
  const isDemoLow = useIsDemoLow();

  const activeBalance = mode === "demo" ? demoBalance : realBalance;
  const isRealReady =
    isConfigured && status === "authenticated" && !profileLoading && balance != null;

  const tryDebit = useCallback(
    async (amount: number, meta?: GameWalletMeta): Promise<boolean> => {
      if (amount <= 0) return false;
      if (mode === "demo") return wallet.tryDebit("demo", amount);

      if (!isConfigured) {
        appToast.raw.error("Supabase가 설정되지 않았습니다");
        return false;
      }
      if (status !== "authenticated") {
        appToast.raw.error("리얼 모드는 로그인이 필요합니다");
        return false;
      }
      if (profileLoading) return false;

      const betAmount = toIntegerPhonAmount(amount);
      if (betAmount == null) return false;

      try {
        const roundId = meta?.roundId ?? crypto.randomUUID();
        const game = meta?.game ?? "game";
        const { balance: row } = await debitPhonForBet(betAmount, game, roundId);
        if (row?.phon != null) syncRealBalance(row.phon);
        await logGameRound(game, roundId, betAmount, 0).catch(() => undefined);
        return true;
      } catch {
        appToast.raw.error("베팅에 실패했습니다 (잔액 부족 또는 네트워크)");
        return false;
      }
    },
    [mode, isConfigured, status, profileLoading],
  );

  /** Credit gross payout (stake + profit on win). */
  const credit = useCallback(
    async (amount: number, multiplier?: number, meta?: GameWalletMeta): Promise<void> => {
      if (amount <= 0) return;
      if (mode === "demo") {
        wallet.credit("demo", amount, multiplier);
        return;
      }
      if (!isConfigured || status !== "authenticated") return;

      const payoutAmount = toIntegerPhonAmount(amount);
      if (payoutAmount == null) return;

      try {
        const roundId = meta?.roundId ?? crypto.randomUUID();
        const game = meta?.game ?? "game";
        const { balance: row } = await creditPhonForPayout(payoutAmount, game, roundId);
        if (row?.phon != null) syncRealBalance(row.phon);
        void logGameRound(game, roundId, 0, payoutAmount).catch(() => undefined);
      } catch {
        appToast.raw.error("정산 동기화에 실패했습니다");
      }
    },
    [mode, isConfigured, status],
  );

  /**
   * Refund unsettled stake (mid-round cancel).
   * Real mode requires meta { game, roundId } (same roundId as debit).
   * Without meta: legacy local cache bump until Lovable PR2 wires call sites (gap window).
   */
  const refund = useCallback(
    async (amount: number, meta?: GameWalletMeta): Promise<boolean> => {
      if (amount <= 0) return false;
      const refundMode = meta?.betMode ?? mode;
      if (refundMode === "demo") {
        wallet.refund("demo", amount);
        return true;
      }
      if (!isConfigured || status !== "authenticated") return false;

      const refundAmount = toIntegerPhonAmount(amount);
      if (refundAmount == null) return false;

      const roundId = meta?.roundId;
      const game = meta?.game;
      if (!roundId || !game) {
        wallet.refund("real", refundAmount);
        return true;
      }

      try {
        const { balance: row } = await refundPhonForBet(refundAmount, game, roundId);
        if (row?.phon != null) syncRealBalance(row.phon);
        return true;
      } catch (err) {
        if (!isBenignRefundError(err)) {
          appToast.raw.error("환불 동기화에 실패했습니다");
        }
        return false;
      }
    },
    [mode, isConfigured, status],
  );

  return {
    mode,
    balance: activeBalance,
    demoBalance,
    realBalance,
    phonBalance: balance?.phon ?? 0,
    stats,
    isDemoLow,
    isRealReady,
    tryDebit,
    credit,
    refund,
    resetDemo: () => wallet.resetDemo(),
  };
}

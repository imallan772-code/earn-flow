import { useBalance, wallet, useWalletStats, useIsDemoLow } from "./walletStore";
import { useMode } from "@/shared/mode/ModeContext";
import { useProfile } from "@/features/profile/useProfile";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Unified game wallet hook.
 * - demo mode: localStorage walletStore (unchanged)
 * - real mode: Supabase phon balance synced into walletStore.realBalance
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
  const isRealReady = !isConfigured || status !== "authenticated" || !profileLoading;

  return {
    mode,
    balance: activeBalance,
    demoBalance,
    realBalance,
    phonBalance: balance?.phon ?? 0,
    stats,
    isDemoLow,
    isRealReady,
    tryDebit: (amount: number) => wallet.tryDebit(mode, amount),
    credit: (amount: number, multiplier?: number) => wallet.credit(mode, amount, multiplier),
    refund: (amount: number) => wallet.refund(mode, amount),
    resetDemo: () => wallet.resetDemo(),
  };
}

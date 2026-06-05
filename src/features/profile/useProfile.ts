import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Profile, WalletBalance } from "@/integrations/supabase/types";
import { useAuth } from "@/features/auth/AuthContext";
import { syncRealBalance } from "@/shared/wallet/walletStore";
import {
  completeOnboardingStep as completeOnboardingStepApi,
  fetchProfileWallet,
} from "@/lib/api/profile";
import {
  PROFILE_WALLET_QUERY_KEY,
  subscribeWalletBalanceRealtime,
} from "@/lib/realtime/walletBalanceChannel";

export interface UserBalanceView {
  phon: number;
  usdt: number;
  krw: number;
  streakDays: number;
  nickname: string;
  referralCode: string;
  vipTier: string;
  vipProgress: number;
}

const PROFILE_QUERY_KEY = PROFILE_WALLET_QUERY_KEY;

function toBalanceView(profile: Profile, wallet: WalletBalance): UserBalanceView {
  return {
    phon: wallet.phon,
    usdt: Number(wallet.usdt),
    krw: wallet.krw,
    streakDays: profile.streak_days,
    nickname: profile.nickname ?? "포나라 유저",
    referralCode: profile.referral_code,
    vipTier: profile.vip_tier,
    vipProgress: Number(profile.vip_progress),
  };
}

export function useProfile() {
  const { user, status, isConfigured } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...PROFILE_QUERY_KEY, user?.id],
    queryFn: () => fetchProfileWallet(user!.id),
    enabled: isConfigured && status === "authenticated" && Boolean(user?.id),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.data?.wallet.phon != null) {
      syncRealBalance(query.data.wallet.phon);
    }
  }, [query.data?.wallet.phon]);

  // Supabase Realtime — wallet_balances sync (singleton channel per user)
  useEffect(() => {
    if (!isConfigured || status !== "authenticated" || !user?.id) return;
    return subscribeWalletBalanceRealtime(user.id, queryClient);
  }, [isConfigured, status, user?.id, queryClient]);

  const balance = query.data ? toBalanceView(query.data.profile, query.data.wallet) : null;

  async function completeOnboardingStep(stepIndex: number, nickname?: string) {
    const result = await completeOnboardingStepApi(stepIndex, nickname);
    await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    return result;
  }

  return {
    ...query,
    balance,
    profile: query.data?.profile ?? null,
    wallet: query.data?.wallet ?? null,
    completeOnboardingStep,
  };
}

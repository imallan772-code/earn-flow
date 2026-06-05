import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Profile, WalletBalance } from "@/integrations/supabase/types";
import { useAuth } from "@/features/auth/AuthContext";
import { syncRealBalance } from "@/shared/wallet/walletStore";
import { getSupabaseClient } from "@/integrations/supabase/client";
import {
  completeOnboardingStep as completeOnboardingStepApi,
  fetchProfileWallet,
} from "@/lib/api/profile";

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

const PROFILE_QUERY_KEY = ["profile", "wallet"] as const;

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

  // Supabase Realtime — wallet_balances sync
  useEffect(() => {
    if (!isConfigured || status !== "authenticated" || !user?.id) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`wallet:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallet_balances",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as WalletBalance;
          if (row?.phon != null) syncRealBalance(row.phon);
          void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
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

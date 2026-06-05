/**
 * Profile API wrappers — Cursor-only SSOT.
 * Features must NOT call supabase.from/rpc directly for profile paths.
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { OnboardingStepResult, Profile, WalletBalance } from "@/integrations/supabase/types";

export async function fetchProfileWallet(userId: string) {
  const supabase = getSupabaseClient();
  const [profileRes, walletRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("wallet_balances").select("*").eq("user_id", userId).single(),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (walletRes.error) throw walletRes.error;
  return {
    profile: profileRes.data as Profile,
    wallet: walletRes.data as WalletBalance,
  };
}

export async function completeOnboardingStep(stepIndex: number, nickname?: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("complete_onboarding_step", {
    p_step_index: stepIndex,
    p_nickname: nickname,
  });
  if (error) throw error;
  return data as OnboardingStepResult;
}

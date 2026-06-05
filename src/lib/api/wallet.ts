/**
 * Wallet RPC wrappers — Cursor-only SSOT for Supabase money paths.
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";

type WalletRpcResult = {
  balance?: WalletBalance;
  game?: string;
  round_id?: string;
};

function parseBalance(data: unknown): WalletBalance | null {
  if (!data || typeof data !== "object") return null;
  const row = (data as WalletRpcResult).balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

export async function debitPhonForBet(amount: number, game: string, roundId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("debit_phon_for_bet", {
    p_amount: amount,
    p_game: game,
    p_round_id: roundId,
  });
  if (error) throw error;
  return { data, balance: parseBalance(data) };
}

export async function creditPhonForPayout(amount: number, game: string, roundId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("credit_phon_for_payout", {
    p_amount: amount,
    p_game: game,
    p_round_id: roundId,
  });
  if (error) throw error;
  return { data, balance: parseBalance(data) };
}

/**
 * Wallet RPC wrappers — Cursor-only SSOT for Supabase money paths.
 *
 * v1 (default): debit_phon_for_bet / credit_phon_for_payout — legacy, unchanged.
 * v2 (opt-in):  debit_phon_for_bet_v2 / credit_phon_for_payout_v2 — idempotent + audited.
 * Enable v2: VITE_MONEY_RPC_V2=true
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import { useMoneyRpcV2, walletBetInputSchema, walletRpcResultSchema } from "./walletSchemas";

function parseBalance(data: unknown): WalletBalance | null {
  const parsed = walletRpcResultSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data.balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

async function callWalletRpc(
  rpcName:
    | "debit_phon_for_bet"
    | "credit_phon_for_payout"
    | "debit_phon_for_bet_v2"
    | "credit_phon_for_payout_v2",
  input: { amount: number; game: string; roundId: string },
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(rpcName, {
    p_amount: input.amount,
    p_game: input.game,
    p_round_id: input.roundId,
  });
  if (error) throw error;
  const result = walletRpcResultSchema.parse(data);
  return { data: result, balance: parseBalance(result) };
}

export async function debitPhonForBet(amount: number, game: string, roundId: string) {
  const input = walletBetInputSchema.parse({ amount, game, roundId });
  const rpc = useMoneyRpcV2 ? "debit_phon_for_bet_v2" : "debit_phon_for_bet";
  return callWalletRpc(rpc, input);
}

export async function creditPhonForPayout(amount: number, game: string, roundId: string) {
  const input = walletBetInputSchema.parse({ amount, game, roundId });
  const rpc = useMoneyRpcV2 ? "credit_phon_for_payout_v2" : "credit_phon_for_payout";
  return callWalletRpc(rpc, input);
}

/** Explicit v2 entry points (for gradual rollout / A-B testing). */
export async function debitPhonForBetV2(amount: number, game: string, roundId: string) {
  const input = walletBetInputSchema.parse({ amount, game, roundId });
  return callWalletRpc("debit_phon_for_bet_v2", input);
}

export async function creditPhonForPayoutV2(amount: number, game: string, roundId: string) {
  const input = walletBetInputSchema.parse({ amount, game, roundId });
  return callWalletRpc("credit_phon_for_payout_v2", input);
}

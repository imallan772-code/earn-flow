/**
 * Wallet RPC wrappers — Cursor-only SSOT for Supabase money paths.
 *
 * debit/credit/refund all use v2 (idempotent + game_rounds audit).
 * refund_phon_for_bet_v2 requires debit_phon_for_bet_v2 — never mix with v1 debit.
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import { walletBetInputSchema, walletRpcResultSchema } from "./walletSchemas";

function parseBalance(data: unknown): WalletBalance | null {
  const parsed = walletRpcResultSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data.balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

type WalletRpcName =
  | "debit_phon_for_bet_v2"
  | "credit_phon_for_payout_v2"
  | "refund_phon_for_bet_v2";

async function callWalletRpc(
  rpcName: WalletRpcName,
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
  return callWalletRpc("debit_phon_for_bet_v2", input);
}

export async function creditPhonForPayout(amount: number, game: string, roundId: string) {
  const input = walletBetInputSchema.parse({ amount, game, roundId });
  return callWalletRpc("credit_phon_for_payout_v2", input);
}

/** Mid-round cancel — always v2; same roundId as debit (no -refund suffix). */
export async function refundPhonForBet(amount: number, game: string, roundId: string) {
  const input = walletBetInputSchema.parse({ amount, game, roundId });
  return callWalletRpc("refund_phon_for_bet_v2", input);
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

export async function refundPhonForBetV2(amount: number, game: string, roundId: string) {
  return refundPhonForBet(amount, game, roundId);
}

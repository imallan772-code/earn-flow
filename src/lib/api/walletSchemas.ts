/**
 * Wallet RPC input bounds — keep in sync with money_validate_bet_input() in Postgres.
 */
import { z } from "zod";

/** Minimum real-mode PHON bet (integer). Demo may use decimals via walletStore. */
export const MIN_PHON_BET = 1;

export const betAmountSchema = z
  .number()
  .int()
  .positive()
  .min(MIN_PHON_BET)
  .max(Number.MAX_SAFE_INTEGER);

export const gameIdSchema = z.string().trim().min(1).max(32);

export const roundIdSchema = z.string().trim().min(1).max(128);

export const walletBetInputSchema = z.object({
  amount: betAmountSchema,
  game: gameIdSchema,
  roundId: roundIdSchema,
});

export const walletRpcResultSchema = z.object({
  balance: z.record(z.unknown()).optional(),
  game: z.string().optional(),
  round_id: z.string().optional(),
  amount: z.number().optional(),
  operation: z
    .enum([
      "debit_phon_for_bet",
      "credit_phon_for_payout",
      "debit_phon_for_bet_v2",
      "credit_phon_for_payout_v2",
      "refund_phon_for_bet_v2",
    ])
    .optional(),
  idempotent: z.boolean().optional(),
  version: z.number().optional(),
});

/** Real-mode amounts must be positive integers >= MIN_PHON_BET. Demo ignores this. */
export function toIntegerPhonAmount(amount: number): number | null {
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  if (rounded !== amount || rounded < MIN_PHON_BET) return null;
  return rounded;
}

/** @deprecated Debit/credit always use v2 RPCs; kept for docs/tests only. */
export const useMoneyRpcV2 = true;

export type WalletBetInput = z.infer<typeof walletBetInputSchema>;

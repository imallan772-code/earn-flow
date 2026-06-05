/**
 * Wallet RPC input bounds — keep in sync with money_validate_bet_input() in Postgres.
 */
import { z } from "zod";

export const betAmountSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

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
    ])
    .optional(),
  idempotent: z.boolean().optional(),
  version: z.number().optional(),
});

/** Opt-in v2 money RPCs (idempotent + audited). Default: v1 for backward compatibility. */
export const useMoneyRpcV2 =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_MONEY_RPC_V2 === "true";

export type WalletBetInput = z.infer<typeof walletBetInputSchema>;

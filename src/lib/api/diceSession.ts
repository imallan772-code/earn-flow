/**
 * Server-authoritative Dice — instant settle via dice_place_v1 (GA-F).
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import { z } from "zod";
import { walletRpcResultSchema } from "./walletSchemas";

const dicePlaceResultSchema = z.object({
  round_id: z.string(),
  mode: z.enum(["demo", "real"]),
  nonce: z.number().int().nonnegative(),
  next_nonce: z.number().int().nonnegative(),
  roll: z.number(),
  won: z.boolean(),
  payout_multiplier: z.number(),
  gross_payout: z.number().int().nonnegative(),
  profit: z.number().int(),
  server_seed_hash: z.string(),
  session_id: z.string().uuid(),
  debit: z.record(z.unknown()).optional(),
  credit: z.record(z.unknown()).optional(),
});

const diceSyncResultSchema = z.object({
  status: z.enum(["idle", "pending_animation"]),
  round_id: z.string().optional(),
  mode: z.enum(["demo", "real"]).optional(),
  nonce: z.number().int().nonnegative().optional(),
  next_nonce: z.number().int().nonnegative().optional(),
  roll: z.number().optional(),
  won: z.boolean().optional(),
  target: z.number().optional(),
  dice_mode: z.enum(["over", "under"]).optional(),
  payout_multiplier: z.number().optional(),
  gross_payout: z.number().int().nonnegative().optional(),
  profit: z.number().int().optional(),
  stake_amount: z.number().int().nonnegative().optional(),
});

export type DicePlaceResult = z.infer<typeof dicePlaceResultSchema>;
export type DiceSyncResult = z.infer<typeof diceSyncResultSchema>;

function parseBalanceFromNested(data: unknown): WalletBalance | null {
  const parsed = walletRpcResultSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data.balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

export async function dicePlace(input: {
  amount: number;
  roundId: string;
  target: number;
  diceMode: "over" | "under";
  clientSeed?: string;
}): Promise<DicePlaceResult & { balance: WalletBalance | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("dice_place_v1", {
    p_amount: input.amount,
    p_round_id: input.roundId,
    p_target: input.target,
    p_dice_mode: input.diceMode,
    ...(input.clientSeed !== undefined ? { p_client_seed: input.clientSeed } : {}),
  });
  if (error) throw error;
  const result = dicePlaceResultSchema.parse(data);
  const balance =
    parseBalanceFromNested(result.credit) ?? parseBalanceFromNested(result.debit);
  return { ...result, balance };
}

export async function diceSync(roundId: string): Promise<DiceSyncResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("dice_sync_v1", { p_round_id: roundId });
  if (error) throw error;
  return diceSyncResultSchema.parse(data);
}

export async function diceComplete(roundId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("dice_complete_v1", { p_round_id: roundId });
  if (error) throw error;
  return Boolean(data);
}

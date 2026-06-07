/**
 * Server-authoritative Limbo — instant settle via limbo_place_v1 (GA-G).
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import { z } from "zod";
import { walletRpcResultSchema } from "./walletSchemas";

const limboPlaceResultSchema = z.object({
  round_id: z.string(),
  mode: z.enum(["demo", "real"]),
  nonce: z.number().int().nonnegative(),
  next_nonce: z.number().int().nonnegative(),
  crash_point: z.number(),
  target: z.number(),
  won: z.boolean(),
  payout_multiplier: z.number(),
  gross_payout: z.number().int().nonnegative(),
  profit: z.number().int(),
  server_seed_hash: z.string(),
  session_id: z.string().uuid(),
  debit: z.record(z.unknown()).optional(),
  credit: z.record(z.unknown()).optional(),
});

const limboSyncResultSchema = z.object({
  status: z.enum(["idle", "pending_animation"]),
  round_id: z.string().optional(),
  mode: z.enum(["demo", "real"]).optional(),
  nonce: z.number().int().nonnegative().optional(),
  next_nonce: z.number().int().nonnegative().optional(),
  crash_point: z.number().optional(),
  target: z.number().optional(),
  won: z.boolean().optional(),
  payout_multiplier: z.number().optional(),
  gross_payout: z.number().int().nonnegative().optional(),
  profit: z.number().int().optional(),
  stake_amount: z.number().int().nonnegative().optional(),
});

export type LimboPlaceResult = z.infer<typeof limboPlaceResultSchema>;
export type LimboSyncResult = z.infer<typeof limboSyncResultSchema>;

function parseBalanceFromNested(data: unknown): WalletBalance | null {
  const parsed = walletRpcResultSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data.balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

export async function limboPlace(input: {
  amount: number;
  roundId: string;
  target: number;
  clientSeed?: string;
}): Promise<LimboPlaceResult & { balance: WalletBalance | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("limbo_place_v1", {
    p_amount: input.amount,
    p_round_id: input.roundId,
    p_target: input.target,
    ...(input.clientSeed !== undefined ? { p_client_seed: input.clientSeed } : {}),
  });
  if (error) throw error;
  const result = limboPlaceResultSchema.parse(data);
  const balance =
    parseBalanceFromNested(result.credit) ?? parseBalanceFromNested(result.debit);
  return { ...result, balance };
}

export async function limboSync(roundId: string): Promise<LimboSyncResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("limbo_sync_v1", { p_round_id: roundId });
  if (error) throw error;
  return limboSyncResultSchema.parse(data);
}

export async function limboComplete(roundId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("limbo_complete_v1", { p_round_id: roundId });
  if (error) throw error;
  return Boolean(data);
}

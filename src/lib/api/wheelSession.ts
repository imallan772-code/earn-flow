/**
 * Server-authoritative Wheel — instant settle via wheel_place_v1 (GA-H).
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import { z } from "zod";
import { walletRpcResultSchema } from "./walletSchemas";

const wheelRiskSchema = z.enum(["low", "medium", "high"]);
const wheelSegmentsSchema = z.union([z.literal(10), z.literal(20), z.literal(30)]);

const wheelPlaceResultSchema = z.object({
  round_id: z.string(),
  mode: z.enum(["demo", "real"]),
  nonce: z.number().int().nonnegative(),
  next_nonce: z.number().int().nonnegative(),
  risk: wheelRiskSchema,
  segments: wheelSegmentsSchema,
  spin_index: z.number().int().nonnegative(),
  multiplier: z.number(),
  won: z.boolean(),
  payout_multiplier: z.number(),
  gross_payout: z.number().int().nonnegative(),
  profit: z.number().int(),
  server_seed_hash: z.string(),
  session_id: z.string().uuid(),
  debit: z.record(z.unknown()).optional(),
  credit: z.record(z.unknown()).optional(),
});

const wheelSyncResultSchema = z.object({
  status: z.enum(["idle", "pending_animation"]),
  round_id: z.string().optional(),
  mode: z.enum(["demo", "real"]).optional(),
  nonce: z.number().int().nonnegative().optional(),
  next_nonce: z.number().int().nonnegative().optional(),
  risk: wheelRiskSchema.optional(),
  segments: wheelSegmentsSchema.optional(),
  spin_index: z.number().int().nonnegative().optional(),
  multiplier: z.number().optional(),
  won: z.boolean().optional(),
  payout_multiplier: z.number().optional(),
  gross_payout: z.number().int().nonnegative().optional(),
  profit: z.number().int().optional(),
  stake_amount: z.number().int().nonnegative().optional(),
});

export type WheelPlaceResult = z.infer<typeof wheelPlaceResultSchema>;
export type WheelSyncResult = z.infer<typeof wheelSyncResultSchema>;

function parseBalanceFromNested(data: unknown): WalletBalance | null {
  const parsed = walletRpcResultSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data.balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

export async function wheelPlace(input: {
  amount: number;
  roundId: string;
  risk: "low" | "medium" | "high";
  segments: 10 | 20 | 30;
  clientSeed?: string;
}): Promise<WheelPlaceResult & { balance: WalletBalance | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("wheel_place_v1", {
    p_amount: input.amount,
    p_round_id: input.roundId,
    p_risk: input.risk,
    p_segments: input.segments,
    ...(input.clientSeed !== undefined ? { p_client_seed: input.clientSeed } : {}),
  });
  if (error) throw error;
  const result = wheelPlaceResultSchema.parse(data);
  const balance =
    parseBalanceFromNested(result.credit) ?? parseBalanceFromNested(result.debit);
  return { ...result, balance };
}

export async function wheelSync(roundId: string): Promise<WheelSyncResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("wheel_sync_v1", { p_round_id: roundId });
  if (error) throw error;
  return wheelSyncResultSchema.parse(data);
}

export async function wheelComplete(roundId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("wheel_complete_v1", { p_round_id: roundId });
  if (error) throw error;
  return Boolean(data);
}

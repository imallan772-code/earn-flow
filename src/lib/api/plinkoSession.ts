/**
 * Server-authoritative Plinko — HMAC path queue via plinko_enqueue_v1 (GA-I).
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import { z } from "zod";
import { walletRpcResultSchema } from "./walletSchemas";

const plinkoRiskSchema = z.enum(["low", "medium", "high"]);
const plinkoRowsSchema = z.union([z.literal(8), z.literal(12), z.literal(16)]);

const plinkoEnqueueResultSchema = z.object({
  round_id: z.string(),
  mode: z.enum(["demo", "real"]),
  nonce: z.number().int().nonnegative(),
  next_nonce: z.number().int().nonnegative(),
  rows: plinkoRowsSchema,
  risk: plinkoRiskSchema,
  path: z.array(z.number().int().min(0).max(1)),
  final_slot: z.number().int().nonnegative(),
  multiplier: z.number(),
  gross_payout: z.number().int(),
  profit: z.number().int(),
  status: z.literal("pending"),
  server_seed_hash: z.string(),
  queue_id: z.string().uuid(),
  debit: z.record(z.unknown()).optional(),
});

const plinkoSyncResultSchema = z.object({
  status: z.enum(["idle", "pending_animation", "completed"]),
  round_id: z.string().optional(),
  mode: z.enum(["demo", "real"]).optional(),
  nonce: z.number().int().nonnegative().optional(),
  rows: plinkoRowsSchema.optional(),
  risk: plinkoRiskSchema.optional(),
  path: z.array(z.number().int()).optional(),
  final_slot: z.number().int().nonnegative().optional(),
  multiplier: z.number().optional(),
  gross_payout: z.number().int().optional(),
  profit: z.number().int().optional(),
  stake_amount: z.number().int().nonnegative().optional(),
});

const plinkoCompleteResultSchema = z.object({
  round_id: z.string().optional(),
  multiplier: z.number().optional(),
  gross_payout: z.number().int().optional(),
  profit: z.number().int().optional(),
  already_completed: z.boolean().optional(),
  ok: z.boolean().optional(),
  reason: z.string().optional(),
  credit: z.record(z.unknown()).optional(),
});

const plinkoPendingItemSchema = z.object({
  round_id: z.string(),
  mode: z.enum(["demo", "real"]),
  nonce: z.number().int().nonnegative(),
  rows: plinkoRowsSchema,
  risk: plinkoRiskSchema,
  path: z.array(z.number().int()),
  final_slot: z.number().int().nonnegative(),
  multiplier: z.number(),
  stake_amount: z.number().int().nonnegative(),
  gross_payout: z.number().int(),
  profit: z.number().int(),
  created_at: z.number().int().optional(),
});

export type PlinkoEnqueueResult = z.infer<typeof plinkoEnqueueResultSchema>;
export type PlinkoSyncResult = z.infer<typeof plinkoSyncResultSchema>;
export type PlinkoPendingItem = z.infer<typeof plinkoPendingItemSchema>;

function parseBalanceFromNested(data: unknown): WalletBalance | null {
  const parsed = walletRpcResultSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data.balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

export async function plinkoEnqueue(input: {
  amount: number;
  roundId: string;
  rows: 8 | 12 | 16;
  risk: "low" | "medium" | "high";
  clientSeed?: string;
}): Promise<PlinkoEnqueueResult & { balance: WalletBalance | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("plinko_enqueue_v1", {
    p_amount: input.amount,
    p_round_id: input.roundId,
    p_rows: input.rows,
    p_risk: input.risk,
    ...(input.clientSeed !== undefined ? { p_client_seed: input.clientSeed } : {}),
  });
  if (error) throw error;
  const result = plinkoEnqueueResultSchema.parse(data);
  const balance = parseBalanceFromNested(result.debit);
  return { ...result, balance };
}

export async function plinkoSync(roundId: string): Promise<PlinkoSyncResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("plinko_sync_v1", { p_round_id: roundId });
  if (error) throw error;
  return plinkoSyncResultSchema.parse(data);
}

export async function plinkoListPending(): Promise<PlinkoPendingItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("plinko_list_pending_v1");
  if (error) throw error;
  const parsed = z
    .object({ status: z.string(), items: z.array(plinkoPendingItemSchema) })
    .parse(data);
  return parsed.items;
}

export async function plinkoComplete(
  roundId: string,
): Promise<PlinkoCompleteResult & { balance: WalletBalance | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("plinko_complete_v1", { p_round_id: roundId });
  if (error) throw error;
  const result = plinkoCompleteResultSchema.parse(data);
  const balance = parseBalanceFromNested(result.credit);
  return { ...result, balance };
}

type PlinkoCompleteResult = z.infer<typeof plinkoCompleteResultSchema>;

export function isPlinkoEnqueueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return (
    e.code === "23505" ||
    msg.includes("PLINKO_ROUND_ALREADY_COMPLETED") ||
    msg.includes("duplicate key")
  );
}

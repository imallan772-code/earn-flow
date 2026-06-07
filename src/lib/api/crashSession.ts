/**
 * Server-authoritative Crash — real/demo via resolve_user_mode_v1 (GA-E).
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import { z } from "zod";
import { walletRpcResultSchema } from "./walletSchemas";

const crashPlaceResultSchema = z.object({
  round_id: z.string(),
  mode: z.enum(["demo", "real"]),
  server_seed_hash: z.string(),
  nonce: z.number().int().nonnegative(),
  started_at_ms: z.number().int().nullable().optional(),
  session_id: z.string().uuid(),
  debit: z.record(z.unknown()).optional(),
});

const crashStartRunningResultSchema = z.object({
  round_id: z.string(),
  started_at_ms: z.number().int(),
});

const crashCashoutResultSchema = z.object({
  round_id: z.string(),
  at_multiplier_e6: z.number().int(),
  crash_point_e6: z.number().int(),
  gross_payout: z.number().int(),
  credit: z.record(z.unknown()).optional(),
  mode: z.enum(["demo", "real"]),
});

const crashSyncResultSchema = z.object({
  status: z.enum(["idle", "betting", "running", "busted", "cashed"]),
  current_multiplier_e6: z.number().int().optional(),
  crash_point_e6: z.number().int().optional(),
});

export type CrashPlaceResult = z.infer<typeof crashPlaceResultSchema>;
export type CrashCashoutResult = z.infer<typeof crashCashoutResultSchema>;
export type CrashSyncResult = z.infer<typeof crashSyncResultSchema>;

function parseBalanceFromNested(data: unknown): WalletBalance | null {
  const parsed = walletRpcResultSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data.balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

export async function crashPlace(input: {
  amount: number;
  roundId: string;
  autoTargetE6?: number;
  clientSeed?: string;
}): Promise<CrashPlaceResult & { balance: WalletBalance | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("crash_place_v1", {
    p_amount: input.amount,
    p_round_id: input.roundId,
    ...(input.autoTargetE6 !== undefined ? { p_auto_target_e6: input.autoTargetE6 } : {}),
    ...(input.clientSeed !== undefined ? { p_client_seed: input.clientSeed } : {}),
  });
  if (error) throw error;
  const result = crashPlaceResultSchema.parse(data);
  const balance = parseBalanceFromNested(result.debit);
  return { ...result, balance };
}

/** Ensure server multiplier clock is armed before cashout (idempotent). */
export async function crashCashout(
  roundId: string,
  atMultiplierE6: number,
): Promise<CrashCashoutResult & { balance: WalletBalance | null }> {
  const supabase = getSupabaseClient();
  await supabase.rpc("crash_start_running_v1", { p_round_id: roundId }).then(() => undefined);
  const { data, error } = await supabase.rpc("crash_cashout_v1", {
    p_round_id: roundId,
    p_at_multiplier_e6: atMultiplierE6,
  });
  if (error) throw error;
  const result = crashCashoutResultSchema.parse(data);
  const balance = parseBalanceFromNested(result.credit);
  return { ...result, balance };
}

export async function crashSync(roundId: string): Promise<CrashSyncResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("crash_sync_v1", { p_round_id: roundId });
  if (error) throw error;
  return crashSyncResultSchema.parse(data);
}

export async function crashStartRunning(
  roundId: string,
): Promise<z.infer<typeof crashStartRunningResultSchema>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("crash_start_running_v1", { p_round_id: roundId });
  if (error) throw error;
  return crashStartRunningResultSchema.parse(data);
}

/** e6 ↔ float helpers — match SQL bigint micro-multiplier storage. */
export function multToE6(mult: number): number {
  return Math.round(mult * 1_000_000);
}

export function multFromE6(e6: number): number {
  return e6 / 1_000_000;
}

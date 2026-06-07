/**
 * Server-authoritative Mines — real mode only (Stake-like).
 * Mine layout never returned until bust; reveal/cashout via RPC.
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import {
  minesCashoutResultSchema,
  minesRevealResultSchema,
  minesStartResultSchema,
} from "@/lib/gameSessions/schemas";
import { walletRpcResultSchema } from "./walletSchemas";

function parseBalanceFromNested(data: unknown): WalletBalance | null {
  const parsed = walletRpcResultSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data.balance;
  return row && typeof row === "object" ? (row as WalletBalance) : null;
}

export async function startMinesRound(input: {
  amount: number;
  roundId: string;
  mineCount: number;
  clientSeed: string;
  nonce: number;
  serverSeed: string;
}) {
  const seed = input.serverSeed?.trim();
  if (!seed) {
    throw new Error("MINES_PF_SEED_REQUIRED");
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("mines_start_round_v1", {
    p_amount: input.amount,
    p_round_id: input.roundId,
    p_mine_count: input.mineCount,
    p_client_seed: input.clientSeed,
    p_nonce: input.nonce,
    p_server_seed: seed,
  });
  if (error) throw error;
  const result = minesStartResultSchema.parse(data);
  const balance = parseBalanceFromNested(result.debit);
  return { ...result, balance };
}

export async function revealMinesTile(roundId: string, tile: number) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("mines_reveal_tile_v1", {
    p_round_id: roundId,
    p_tile: tile,
  });
  if (error) throw error;
  return minesRevealResultSchema.parse(data);
}

export async function cashoutMinesRound(roundId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("mines_cashout_v2", {
    p_round_id: roundId,
  });
  if (error) throw error;
  const result = minesCashoutResultSchema.parse(data);
  const balance = parseBalanceFromNested(result.credit);
  return { ...result, balance };
}

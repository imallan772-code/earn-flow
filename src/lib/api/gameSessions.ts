/**
 * Stake-like active session RPC wrappers — real mode resume SSOT (cross-device).
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { gameSessionRowSchema, type GameSessionRow } from "@/lib/gameSessions/schemas";

export async function getGameActiveSession(game: string): Promise<GameSessionRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_game_active_session_v1", { p_game: game });
  if (error) throw error;
  if (data == null) return null;
  return gameSessionRowSchema.parse(data);
}

export async function syncGameActiveSession(
  game: string,
  roundId: string,
  betAmount: number,
  clientState: Record<string, unknown>,
): Promise<GameSessionRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("sync_game_active_session_v1", {
    p_game: game,
    p_round_id: roundId,
    p_bet_amount: betAmount,
    p_client_state: clientState as Json,
  });
  if (error) throw error;
  return gameSessionRowSchema.parse(data);
}

export async function clearGameActiveSession(game: string, roundId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("clear_game_active_session_v1", {
    p_game: game,
    p_round_id: roundId,
  });
  if (error) throw error;
  return Boolean(data);
}

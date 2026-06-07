/**
 * Shared helpers for RPC smoke + forensic betting suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getE2eCredentials, getServiceRoleKey, requireEnv } from "../e2e/utils/env";

export async function clearAllActiveSessions(uid: string): Promise<number> {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) return 0;
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data } = await admin
    .from("game_active_sessions")
    .update({ status: "settled", updated_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("status", "active")
    .select("id");
  return data?.length ?? 0;
}

const GAME_IDS = ["crash", "dice", "limbo", "wheel", "plinko", "mines"] as const;
export type SmokeGame = (typeof GAME_IDS)[number];

/** Fast per-game session clear (E2E parallel-safe). */
export async function clearActiveSessionsForGame(
  supabase: SupabaseClient,
  game: SmokeGame,
): Promise<void> {
  const { data, error } = await supabase.rpc("get_game_active_session_v1", { p_game: game });
  if (error || !data) return;
  const row = data as { round_id?: string };
  if (row.round_id) {
    await supabase.rpc("clear_game_active_session_v1", {
      p_game: game,
      p_round_id: row.round_id,
    });
  }
}

export async function clearAllGameSessionsViaRpc(supabase: SupabaseClient): Promise<number> {
  let n = 0;
  for (const game of GAME_IDS) {
    const before = await supabase.rpc("get_game_active_session_v1", { p_game: game });
    if (before.data) {
      await clearActiveSessionsForGame(supabase, game);
      n += 1;
    }
  }
  return n;
}

export async function ensureDemoMode(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
  if (error) throw new Error(`user_set_preferred_mode_v1 demo: ${error.message}`);
}

export async function ensureRealMode(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "real" });
  if (error) throw new Error(`user_set_preferred_mode_v1 real: ${error.message}`);
}

/** Reset E2E user: settle all active sessions + demo mode. */
export async function resetE2eBettingState(supabase: SupabaseClient): Promise<{ cleared: number }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("AUTH_REQUIRED for reset");
  const cleared = await clearAllActiveSessions(uid);
  await ensureDemoMode(supabase);
  return { cleared };
}

/** Reset sessions and switch E2E user to real mode (for real-path UI/RPC tests). */
export async function resetE2eRealBettingState(
  supabase: SupabaseClient,
): Promise<{ cleared: number }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("AUTH_REQUIRED for reset");
  const cleared = await clearAllActiveSessions(uid);
  await ensureRealMode(supabase);
  return { cleared };
}

export async function signInE2e(): Promise<SupabaseClient> {
  const creds = getE2eCredentials();
  if (!creds) throw new Error("E2E credentials required");
  const url = requireEnv("VITE_SUPABASE_URL");
  const anon = requireEnv("VITE_SUPABASE_ANON_KEY");
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) throw error;
  return supabase;
}

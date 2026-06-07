import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

/**
 * GA-A: ensure every visitor has a Supabase user_id for pf_sessions.
 * Anonymous sign-in must be enabled in Supabase Auth dashboard.
 */
export async function ensureAnonymousSession(
  supabase: SupabaseClient,
): Promise<Session | null> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn("[auth] anonymous sign-in failed:", error.message);
    return null;
  }
  return data.session;
}

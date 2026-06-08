import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

/**
 * GA-A: ensure every visitor has a Supabase user_id for pf_sessions.
 * Production auth has anonymous sign-in disabled; do not create surprise users.
 * Existing sessions are restored, and guests use explicit local demo fallback.
 */
export async function ensureAnonymousSession(
  supabase: SupabaseClient,
): Promise<Session | null> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session;
  return null;
}

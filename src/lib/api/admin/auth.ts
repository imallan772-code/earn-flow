import { getSupabaseClient } from "@/integrations/supabase/client";

/** Server-side admin_users membership check (never trust client-only flags). */
export async function fetchIsAdmin(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return Boolean(data);
}

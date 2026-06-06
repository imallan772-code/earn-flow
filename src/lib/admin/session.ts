import { getSupabaseClient } from "@/integrations/supabase/client";

/** Current Supabase access token for admin API routes (Bearer). */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/** JSON + optional Authorization for /api/admin/* routes. */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await getSupabaseAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getSupabaseEnv } from "./env";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (!browserClient) {
    const { url, anonKey } = getSupabaseEnv();
    browserClient = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        flowType: "pkce",
        experimental: { passkey: true },
      },
    });
  }
  return browserClient;
}

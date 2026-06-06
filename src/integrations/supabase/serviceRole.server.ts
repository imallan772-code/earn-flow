/**
 * Server-only Supabase client with service_role key.
 * Used by cron routes and asset upload — never import from client/features.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getServerConfig } from "@/lib/config.server";

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;

export function getServiceRoleClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getServerConfig();
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  if (!serviceClient) {
    serviceClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export function isServiceRoleConfigured(): boolean {
  return getServiceRoleClient() !== null;
}

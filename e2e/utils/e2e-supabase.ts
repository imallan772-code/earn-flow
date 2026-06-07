/**
 * Cached E2E Supabase client — one sign-in per worker/process.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInE2e } from "../../scripts/smoke-utils";

let cached: SupabaseClient | null = null;

export async function getE2eSupabase(): Promise<SupabaseClient> {
  if (!cached) {
    cached = await signInE2e();
  }
  return cached;
}

export function resetE2eSupabaseCache(): void {
  cached = null;
}

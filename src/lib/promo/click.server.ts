/**
 * Server-side promo click insert (public redirect route).
 * Uses anon key + record_promo_click SECURITY DEFINER RPC.
 */
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function hashPromoTelemetry(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function getServerAnonClient() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function recordPromoClickServer(input: {
  slug: string;
  channel?: string;
  variantId?: string;
  referrer?: string;
  ua?: string;
  ip?: string;
}): Promise<string | null> {
  const supabase = getServerAnonClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("record_promo_click", {
    p_slug: input.slug,
    p_channel: input.channel ?? "unknown",
    p_variant_id: input.variantId,
    p_referrer: input.referrer,
    p_ua_hash: input.ua ? hashPromoTelemetry(input.ua) : undefined,
    p_ip_hash: input.ip ? hashPromoTelemetry(input.ip) : undefined,
  });

  if (error) {
    console.warn("[promo:r] record_promo_click:", error.message);
    return null;
  }
  return data;
}

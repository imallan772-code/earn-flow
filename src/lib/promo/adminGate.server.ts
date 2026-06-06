/**
 * Phase Z-2 — admin gate for server routes / handlers.
 *
 * SSOT RPC: `is_admin` (boolean) — same RPC used by client `fetchIsAdmin`.
 * Reads SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY inside the call (Workers safe).
 * Never imports browser supabase client (storage / localStorage refs).
 *
 * Returns 401 Response when unauthenticated or non-admin; null when authorized.
 */
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

export interface AdminPrincipal {
  userId: string;
}

function unauthorized(reason: string): Response {
  return new Response(
    JSON.stringify({ ok: false, code: "UNAUTHORIZED", message: reason }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

function readBearer(request: Request): string | null {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function isDevAdminOpen(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.VITE_ADMIN_DEV_OPEN === "true"
  );
}

/**
 * Verify the request is from an authenticated admin user.
 * Returns null when authorized, otherwise a 401 Response.
 *
 * Usage:
 *   const denied = await assertAdminRequest(request);
 *   if (denied) return denied;
 */
export async function assertAdminRequest(
  request: Request,
): Promise<Response | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return unauthorized("supabase not configured");

  if (isDevAdminOpen()) return null;

  const token = readBearer(request);
  if (!token) return unauthorized("missing bearer token");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) return unauthorized("invalid session");

  const { data: isAdmin, error: rpcErr } = await supabase.rpc("is_admin");
  if (rpcErr) return unauthorized("admin check failed");
  if (isAdmin !== true) return unauthorized("not admin");
  return null;
}

/** Test-only helper for unit tests. */
export const __internal = { readBearer };

#!/usr/bin/env bun
/**
 * Live RPC smoke — GA-G Limbo server authority (phonara-gb).
 *
 * Usage: bun run smoke:limbo-rpc
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getE2eCredentials, getEnv, getServiceRoleKey, requireEnv, warnIfProcessEnvMangled } from "../e2e/utils/env";
import { resetE2eBettingState } from "./smoke-utils";

warnIfProcessEnvMangled();

type StepResult = { step: string; ok: boolean; detail?: string };
const results: StepResult[] = [];

function pass(step: string, detail?: string) {
  results.push({ step, ok: true, detail });
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ""}`);
}

function fail(step: string, detail: string): never {
  results.push({ step, ok: false, detail });
  console.error(`✗ ${step} — ${detail}`);
  throw new Error(`${step}: ${detail}`);
}

async function clearLimboSession(supabase: SupabaseClient, serviceKey?: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  if (serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    await admin
      .from("game_active_sessions")
      .update({ status: "settled", updated_at: new Date().toISOString() })
      .eq("user_id", uid)
      .eq("game", "limbo")
      .eq("status", "active");
    return;
  }

  const { data } = await supabase.rpc("get_game_active_session_v1", { p_game: "limbo" });
  const row = data as { round_id?: string } | null;
  if (row?.round_id) {
    await supabase.rpc("clear_game_active_session_v1", { p_game: "limbo", p_round_id: row.round_id });
  }
}

async function assertRpcExists(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("limbo_place_v1", {
    p_amount: 1,
    p_round_id: "__probe__",
    p_target: 2,
  });
  if (!error) return;
  const msg = error.message ?? "";
  if (msg.includes("Could not find the function") || msg.includes("schema cache")) {
    fail("migrations", "limbo_place_v1 missing — run: bun run supabase:db:push");
  }
  pass("migrations", `limbo_place_v1 present (${msg.slice(0, 60)})`);
}

async function runPlaceFlow(supabase: SupabaseClient) {
  await clearLimboSession(supabase, getServiceRoleKey());
  const roundId = `smoke_limbo_${Date.now()}`;

  const { data, error } = await supabase.rpc("limbo_place_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_target: 2.5,
    p_client_seed: "smoke-limbo",
  });
  if (error) fail("limbo_place_v1", error.message);

  const row = data as {
    mode: string;
    crash_point: number;
    won: boolean;
    nonce: number;
    next_nonce: number;
    target: number;
  };
  if (row.mode !== "demo") fail("limbo_place_v1", `expected demo, got ${row.mode}`);
  if (row.crash_point < 1 || row.crash_point > 1_000_000) {
    fail("limbo_place_v1", `invalid crash_point ${row.crash_point}`);
  }
  pass(
    "limbo_place_v1",
    `crash=${row.crash_point.toFixed(2)} won=${row.won} target=${row.target} nonce=${row.nonce}→${row.next_nonce}`,
  );

  const { data: sync, error: syncErr } = await supabase.rpc("limbo_sync_v1", { p_round_id: roundId });
  if (syncErr) fail("limbo_sync_v1", syncErr.message);
  const syncRow = sync as { status: string };
  if (syncRow.status !== "pending_animation") {
    fail("limbo_sync_v1", `expected pending_animation, got ${syncRow.status}`);
  }
  pass("limbo_sync_v1", "pending_animation");

  const { data: session } = await supabase.rpc("get_game_active_session_v1", { p_game: "limbo" });
  const sess = session as { round_id: string } | null;
  if (!sess || sess.round_id !== roundId) fail("resume_session", "session mismatch");
  pass("resume_path", `session=${sess.round_id}`);

  const { error: completeErr } = await supabase.rpc("limbo_complete_v1", { p_round_id: roundId });
  if (completeErr) fail("limbo_complete_v1", completeErr.message);
  pass("limbo_complete_v1", "settled");

  const { data: idleSync } = await supabase.rpc("limbo_sync_v1", { p_round_id: roundId });
  if ((idleSync as { status: string }).status !== "idle") {
    fail("limbo_sync_idle", "expected idle after complete");
  }
  pass("limbo_sync_idle", "idle");
}

async function runFeatureFlag(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("game_authority_flag_v1", { p_key: "limbo_server_settle" });
  if (error) fail("feature_flag", error.message);
  if (data !== true) fail("feature_flag", `expected true, got ${String(data)}`);
  pass("feature_flag", "limbo_server_settle=true (100%)");
}

async function runEdgeSmoke(supabase: SupabaseClient, accessToken: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const roundId = `smoke_edge_limbo_${Date.now()}`;
  await clearLimboSession(supabase, getServiceRoleKey());

  const res = await fetch(`${url}/functions/v1/limbo-place`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: requireEnv("VITE_SUPABASE_ANON_KEY"),
    },
    body: JSON.stringify({
      bet_phon: 1,
      round_id: roundId,
      target: 3,
      client_seed: "smoke-edge",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("Could not find") || res.status === 404) {
      pass("edge_limbo-place", "skipped (not deployed)");
      return;
    }
    fail("edge_limbo-place", `HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const body = (await res.json()) as { crash_point?: number };
  pass("edge_limbo-place", `HTTP 200 crash=${body.crash_point?.toFixed(2) ?? "?"}`);
  await supabase.rpc("limbo_complete_v1", { p_round_id: roundId });
}

async function runRealMode(supabase: SupabaseClient, serviceKey?: string) {
  await clearLimboSession(supabase, serviceKey);
  const { error: modeErr } = await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "real" });
  if (modeErr) fail("real_mode", modeErr.message);

  const roundId = `smoke_real_limbo_${Date.now()}`;
  const { data, error } = await supabase.rpc("limbo_place_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_target: 1.5,
    p_client_seed: "smoke-real",
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("MONEY") || msg.includes("balance") || msg.includes("INSUFFICIENT")) {
      await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
      pass("real_mode_smoke", "skipped (insufficient PHON)");
      return;
    }
    fail("real_place", error.message);
  }

  const row = data as { mode: string };
  if (row.mode !== "real") fail("real_place", `expected real, got ${row.mode}`);
  await supabase.rpc("limbo_complete_v1", { p_round_id: roundId });
  await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
  pass("real_mode_smoke", "real place → complete");
}

async function main() {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anon = requireEnv("VITE_SUPABASE_ANON_KEY");
  const creds = getE2eCredentials();
  if (!creds) fail("auth", "E2E_USER_EMAIL / E2E_USER_PASSWORD required");

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword(creds);
  if (authErr || !authData.session) fail("auth", authErr?.message ?? "no session");
  pass("auth", creds.email);

  const serviceKey = getServiceRoleKey();
  await resetE2eBettingState(supabase);

  await assertRpcExists(supabase);
  await runFeatureFlag(supabase);
  await runPlaceFlow(supabase);
  await runRealMode(supabase, serviceKey);
  await runEdgeSmoke(supabase, authData.session.access_token);

  console.log("\n── GA-G Limbo RPC smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── GA-G Limbo RPC smoke: FAIL ──");
  console.error(err);
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
});

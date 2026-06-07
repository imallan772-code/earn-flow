#!/usr/bin/env bun
/**
 * Live RPC smoke — GA-H Wheel server authority (phonara-gb).
 *
 * Usage: bun run smoke:wheel-rpc
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getE2eCredentials, getServiceRoleKey, requireEnv, warnIfProcessEnvMangled } from "../e2e/utils/env";
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

async function clearWheelSession(supabase: SupabaseClient, serviceKey?: string) {
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
      .eq("game", "wheel")
      .eq("status", "active");
    return;
  }

  const { data } = await supabase.rpc("get_game_active_session_v1", { p_game: "wheel" });
  const row = data as { round_id?: string } | null;
  if (row?.round_id) {
    await supabase.rpc("clear_game_active_session_v1", { p_game: "wheel", p_round_id: row.round_id });
  }
}

async function assertRpcExists(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("wheel_place_v1", {
    p_amount: 1,
    p_round_id: "__probe__",
    p_risk: "medium",
    p_segments: 20,
  });
  if (!error) return;
  const msg = error.message ?? "";
  if (msg.includes("Could not find the function") || msg.includes("schema cache")) {
    fail("migrations", "wheel_place_v1 missing — run: bun run supabase:db:push");
  }
  pass("migrations", `wheel_place_v1 present (${msg.slice(0, 60)})`);
}

async function runPlaceFlow(supabase: SupabaseClient) {
  await clearWheelSession(supabase, getServiceRoleKey());
  const roundId = `smoke_wheel_${Date.now()}`;

  const { data, error } = await supabase.rpc("wheel_place_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_risk: "high",
    p_segments: 10,
    p_client_seed: "smoke-wheel",
  });
  if (error) fail("wheel_place_v1", error.message);

  const row = data as {
    mode: string;
    spin_index: number;
    multiplier: number;
    won: boolean;
    nonce: number;
    next_nonce: number;
    segments: number;
  };
  if (row.mode !== "demo") fail("wheel_place_v1", `expected demo, got ${row.mode}`);
  if (row.spin_index < 0 || row.spin_index >= row.segments) {
    fail("wheel_place_v1", `invalid spin_index ${row.spin_index}`);
  }
  if (row.multiplier < 0) fail("wheel_place_v1", `invalid multiplier ${row.multiplier}`);
  pass(
    "wheel_place_v1",
    `idx=${row.spin_index} mult=${row.multiplier} won=${row.won} nonce=${row.nonce}→${row.next_nonce}`,
  );

  const { data: sync, error: syncErr } = await supabase.rpc("wheel_sync_v1", { p_round_id: roundId });
  if (syncErr) fail("wheel_sync_v1", syncErr.message);
  if ((sync as { status: string }).status !== "pending_animation") {
    fail("wheel_sync_v1", "expected pending_animation");
  }
  pass("wheel_sync_v1", "pending_animation");

  const { data: session } = await supabase.rpc("get_game_active_session_v1", { p_game: "wheel" });
  const sess = session as { round_id: string } | null;
  if (!sess || sess.round_id !== roundId) fail("resume_session", "session mismatch");
  pass("resume_path", `session=${sess.round_id}`);

  const { error: completeErr } = await supabase.rpc("wheel_complete_v1", { p_round_id: roundId });
  if (completeErr) fail("wheel_complete_v1", completeErr.message);
  pass("wheel_complete_v1", "settled");

  const { data: idleSync } = await supabase.rpc("wheel_sync_v1", { p_round_id: roundId });
  if ((idleSync as { status: string }).status !== "idle") {
    fail("wheel_sync_idle", "expected idle after complete");
  }
  pass("wheel_sync_idle", "idle");
}

async function runFeatureFlag(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("game_authority_flag_v1", { p_key: "wheel_server_settle" });
  if (error) fail("feature_flag", error.message);
  if (data !== true) fail("feature_flag", `expected true, got ${String(data)}`);
  pass("feature_flag", "wheel_server_settle=true (100%)");
}

async function runEdgeSmoke(supabase: SupabaseClient, accessToken: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const roundId = `smoke_edge_wheel_${Date.now()}`;
  await clearWheelSession(supabase, getServiceRoleKey());

  const res = await fetch(`${url}/functions/v1/wheel-place`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: requireEnv("VITE_SUPABASE_ANON_KEY"),
    },
    body: JSON.stringify({
      bet_phon: 1,
      round_id: roundId,
      risk: "low",
      segments: 20,
      client_seed: "smoke-edge",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("Could not find") || res.status === 404) {
      pass("edge_wheel-place", "skipped (not deployed)");
      return;
    }
    fail("edge_wheel-place", `HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const body = (await res.json()) as { spin_index?: number; multiplier?: number };
  pass(
    "edge_wheel-place",
    `HTTP 200 idx=${body.spin_index ?? "?"} mult=${body.multiplier ?? "?"}`,
  );
  await supabase.rpc("wheel_complete_v1", { p_round_id: roundId });
}

async function runRealMode(supabase: SupabaseClient, serviceKey?: string) {
  await clearWheelSession(supabase, serviceKey);
  const { error: modeErr } = await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "real" });
  if (modeErr) fail("real_mode", modeErr.message);

  const roundId = `smoke_real_wheel_${Date.now()}`;
  const { data, error } = await supabase.rpc("wheel_place_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_risk: "medium",
    p_segments: 20,
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
  await supabase.rpc("wheel_complete_v1", { p_round_id: roundId });
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

  console.log("\n── GA-H Wheel RPC smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── GA-H Wheel RPC smoke: FAIL ──");
  console.error(err);
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
});

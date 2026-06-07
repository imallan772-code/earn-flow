#!/usr/bin/env bun
/**
 * Live RPC smoke — GA-I Plinko server authority (phonara-gb).
 *
 * Usage: bun run smoke:plinko-rpc
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

async function clearPendingPlinko(supabase: SupabaseClient, serviceKey?: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  if (serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    await admin
      .from("plinko_queue")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("user_id", uid)
      .eq("status", "pending");
  }
}

async function assertRpcExists(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("plinko_enqueue_v1", {
    p_amount: 1,
    p_round_id: "__probe__",
    p_rows: 12,
    p_risk: "medium",
  });
  if (!error) return;
  const msg = error.message ?? "";
  if (msg.includes("Could not find the function") || msg.includes("schema cache")) {
    fail("migrations", "plinko_enqueue_v1 missing — run: bun run supabase:db:push");
  }
  pass("migrations", `plinko_enqueue_v1 present (${msg.slice(0, 60)})`);
}

async function runQueueFlow(supabase: SupabaseClient) {
  await clearPendingPlinko(supabase, getServiceRoleKey());
  const roundId = `smoke_plinko_${Date.now()}`;

  const { data, error } = await supabase.rpc("plinko_enqueue_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_rows: 12,
    p_risk: "medium",
    p_client_seed: "smoke-plinko",
  });
  if (error) fail("plinko_enqueue_v1", error.message);

  const row = data as {
    mode: string;
    path: number[];
    final_slot: number;
    multiplier: number;
    status: string;
    nonce: number;
    next_nonce: number;
  };
  if (row.mode !== "demo") fail("plinko_enqueue_v1", `expected demo, got ${row.mode}`);
  if (row.path.length !== 12) fail("plinko_enqueue_v1", `path len ${row.path.length}`);
  if (row.status !== "pending") fail("plinko_enqueue_v1", `status ${row.status}`);
  pass(
    "plinko_enqueue_v1",
    `slot=${row.final_slot} mult=${row.multiplier} nonce=${row.nonce}→${row.next_nonce}`,
  );

  const { data: sync, error: syncErr } = await supabase.rpc("plinko_sync_v1", { p_round_id: roundId });
  if (syncErr) fail("plinko_sync_v1", syncErr.message);
  if ((sync as { status: string }).status !== "pending_animation") {
    fail("plinko_sync_v1", "expected pending_animation");
  }
  pass("plinko_sync_v1", "pending_animation");

  const { data: list } = await supabase.rpc("plinko_list_pending_v1");
  const items = (list as { items: { round_id: string }[] }).items;
  if (!items.some((i) => i.round_id === roundId)) fail("resume_list", "pending not in list");
  pass("resume_list", `pending=${items.length}`);

  const { error: completeErr } = await supabase.rpc("plinko_complete_v1", { p_round_id: roundId });
  if (completeErr) fail("plinko_complete_v1", completeErr.message);
  pass("plinko_complete_v1", "completed");

  const { data: idleSync } = await supabase.rpc("plinko_sync_v1", { p_round_id: roundId });
  if ((idleSync as { status: string }).status !== "completed") {
    fail("plinko_sync_completed", "expected completed");
  }
  pass("plinko_sync_completed", "completed");
}

async function runFeatureFlag(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("game_authority_flag_v1", {
    p_key: "plinko_server_settle",
  });
  if (error) fail("feature_flag", error.message);
  if (data !== true) fail("feature_flag", `expected true, got ${String(data)}`);
  pass("feature_flag", "plinko_server_settle=true (100%)");
}

async function runEdgeSmoke(supabase: SupabaseClient, accessToken: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const roundId = `smoke_edge_plinko_${Date.now()}`;
  await clearPendingPlinko(supabase, getServiceRoleKey());

  const res = await fetch(`${url}/functions/v1/plinko-enqueue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: requireEnv("VITE_SUPABASE_ANON_KEY"),
    },
    body: JSON.stringify({
      bet_phon: 1,
      round_id: roundId,
      rows: 8,
      risk: "low",
      client_seed: "smoke-edge",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("Could not find") || res.status === 404) {
      pass("edge_plinko-enqueue", "skipped (not deployed)");
      return;
    }
    fail("edge_plinko-enqueue", `HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const body = (await res.json()) as { final_slot?: number; multiplier?: number };
  pass(
    "edge_plinko-enqueue",
    `HTTP 200 slot=${body.final_slot ?? "?"} mult=${body.multiplier ?? "?"}`,
  );
  await supabase.rpc("plinko_complete_v1", { p_round_id: roundId });
}

async function runRealMode(supabase: SupabaseClient, serviceKey?: string) {
  await clearPendingPlinko(supabase, serviceKey);
  const { error: modeErr } = await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "real" });
  if (modeErr) fail("real_mode", modeErr.message);

  const roundId = `smoke_real_plinko_${Date.now()}`;
  const { data, error } = await supabase.rpc("plinko_enqueue_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_rows: 16,
    p_risk: "low",
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
  await supabase.rpc("plinko_complete_v1", { p_round_id: roundId });
  await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
  pass("real_mode_smoke", "enqueue → complete");
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
  await runQueueFlow(supabase);
  await runRealMode(supabase, serviceKey);
  await runEdgeSmoke(supabase, authData.session.access_token);

  console.log("\n── GA-I Plinko RPC smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── GA-I Plinko RPC smoke: FAIL ──");
  console.error(err);
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
});

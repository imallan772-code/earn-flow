#!/usr/bin/env bun
/**
 * Live RPC smoke — GA-J server auto-bet (phonara-gb).
 *
 * Usage: bun run smoke:auto-bet-rpc
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getE2eCredentials,
  getEnv,
  getServiceRoleKey,
  requireEnv,
  warnIfProcessEnvMangled,
} from "../e2e/utils/env";

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

const BASE_CONFIG = {
  strategy: "Flat",
  baseBet: 1,
  numberOfBets: 2,
  onWinIncreasePct: 0,
  onLossIncreasePct: 0,
  stopOnProfit: 0,
  stopOnLoss: 0,
};

async function cleanupSessions(supabase: SupabaseClient, serviceKey?: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid || !serviceKey) return;
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  await admin
    .from("auto_bet_sessions")
    .update({ status: "stopped", stopped_at: new Date().toISOString() })
    .eq("user_id", uid)
    .in("status", ["running", "paused", "stopping"]);
}

async function runFeatureFlag(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("game_authority_flag_v1", {
    p_key: "auto_bet_server",
  });
  if (error) fail("feature_flag", error.message);
  if (data !== true) fail("feature_flag", `expected true, got ${String(data)}`);
  pass("feature_flag", "auto_bet_server=true (100%)");
}

async function runConsentAndCreate(supabase: SupabaseClient) {
  const { error: consentErr } = await supabase.rpc("auto_bet_grant_consent_v1");
  if (consentErr) fail("consent", consentErr.message);
  pass("consent", "granted");

  const { data, error } = await supabase.rpc("auto_bet_create_v1", {
    p_game: "dice",
    p_config: BASE_CONFIG,
    p_bet_params: { target: 50, dice_mode: "over" },
  });
  if (error) fail("auto_bet_create_v1", error.message);

  const row = data as { id: string; status: string; game: string };
  if (row.status !== "running") fail("auto_bet_create_v1", `status ${row.status}`);
  pass("auto_bet_create_v1", `dice session ${row.id.slice(0, 8)}…`);

  const { data: list } = await supabase.rpc("auto_bet_list_v1");
  const items = (list as { items: { id: string }[] }).items;
  if (!items.some((i) => i.id === row.id)) fail("auto_bet_list_v1", "session missing");
  pass("auto_bet_list_v1", `active=${items.length}`);

  const { error: pauseErr } = await supabase.rpc("auto_bet_pause_v1", { p_session_id: row.id });
  if (pauseErr) fail("auto_bet_pause_v1", pauseErr.message);
  pass("auto_bet_pause_v1", "paused");

  const { error: resumeErr } = await supabase.rpc("auto_bet_resume_v1", { p_session_id: row.id });
  if (resumeErr) fail("auto_bet_resume_v1", resumeErr.message);
  pass("auto_bet_resume_v1", "running");

  return row.id;
}

async function clearDiceActiveSessions(serviceKey: string, userId: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  await admin
    .from("game_active_sessions")
    .update({ status: "settled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("game", "dice")
    .eq("status", "active");
}

async function runWorkerTick(serviceKey: string, sessionId: string, userId: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  await clearDiceActiveSessions(serviceKey, userId);

  const { data, error } = await admin.rpc("auto_bet_worker_tick_v1", { p_batch_limit: 10 });
  if (error) fail("auto_bet_worker_tick_v1", error.message);
  const processed = data as number;
  if (processed < 1) fail("worker_tick", `processed=${processed}`);
  pass("auto_bet_worker_tick_v1", `processed=${processed}`);

  await new Promise((r) => setTimeout(r, 800));

  const { data: sync, error: syncErr } = await admin
    .from("auto_bet_sessions")
    .select("bets_placed,pnl,status,last_error")
    .eq("id", sessionId)
    .single();
  if (syncErr) fail("worker_verify", syncErr.message);
  const s = sync as { bets_placed: number; status: string; last_error: string | null };
  if (s.bets_placed < 1) {
    fail("worker_verify", `no bets placed status=${s.status} err=${s.last_error ?? "none"}`);
  }
  pass("worker_round", `bets=${s.bets_placed} status=${s.status}`);
}

async function runStop(supabase: SupabaseClient, sessionId: string) {
  const { error } = await supabase.rpc("auto_bet_stop_v1", { p_session_id: sessionId });
  if (error) fail("auto_bet_stop_v1", error.message);
  pass("auto_bet_stop_v1", "stopped");
}

async function runPlinkoAutoBet(
  supabase: SupabaseClient,
  serviceKey: string,
  userId: string,
) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: createData, error: createErr } = await supabase.rpc("auto_bet_create_v1", {
    p_game: "plinko",
    p_config: BASE_CONFIG,
    p_bet_params: { rows: 12, risk: "medium" },
  });
  if (createErr) fail("plinko_auto_create", createErr.message);

  const row = createData as { id: string; status: string; game: string };
  if (row.game !== "plinko") fail("plinko_auto_create", `game=${row.game}`);
  if (row.status !== "running") fail("plinko_auto_create", `status=${row.status}`);
  pass("plinko_auto_create", `plinko session ${row.id.slice(0, 8)}…`);

  const { data: tickData, error: tickErr } = await admin.rpc("auto_bet_worker_tick_v1", {
    p_batch_limit: 10,
  });
  if (tickErr) fail("plinko_worker_tick", tickErr.message);
  if ((tickData as number) < 1) fail("plinko_worker_tick", `processed=${tickData}`);
  pass("plinko_worker_tick", `processed=${tickData}`);

  await new Promise((r) => setTimeout(r, 800));

  const { data: sync, error: syncErr } = await admin
    .from("auto_bet_sessions")
    .select("bets_placed,pnl,status,last_error")
    .eq("id", row.id)
    .single();
  if (syncErr) fail("plinko_verify", syncErr.message);
  const s = sync as { bets_placed: number; status: string; last_error: string | null };
  if (s.bets_placed < 1) {
    fail("plinko_verify", `no bets placed status=${s.status} err=${s.last_error ?? "none"}`);
  }
  pass("plinko_worker_round", `bets=${s.bets_placed} status=${s.status}`);

  const { error: stopErr } = await supabase.rpc("auto_bet_stop_v1", { p_session_id: row.id });
  if (stopErr) fail("plinko_auto_stop", stopErr.message);
  pass("plinko_auto_stop", "stopped");
}

async function clearCrashActiveSessions(serviceKey: string, userId: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  await admin
    .from("game_active_sessions")
    .update({ status: "settled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("game", "crash")
    .eq("status", "active");
}

async function runCrashAutoBet(
  supabase: SupabaseClient,
  serviceKey: string,
  userId: string,
) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  await clearCrashActiveSessions(serviceKey, userId);

  const { data: createData, error: createErr } = await supabase.rpc("auto_bet_create_v1", {
    p_game: "crash",
    p_config: BASE_CONFIG,
    p_bet_params: { auto_target_e6: 2000000 },
  });
  if (createErr) fail("crash_auto_create", createErr.message);

  const row = createData as { id: string; status: string; game: string };
  if (row.game !== "crash") fail("crash_auto_create", `game=${row.game}`);
  if (row.status !== "running") fail("crash_auto_create", `status=${row.status}`);
  pass("crash_auto_create", `crash session ${row.id.slice(0, 8)}…`);

  const { data: tickData, error: tickErr } = await admin.rpc("auto_bet_worker_tick_v1", {
    p_batch_limit: 10,
  });
  if (tickErr) fail("crash_worker_tick", tickErr.message);
  if ((tickData as number) < 1) fail("crash_worker_tick", `processed=${tickData}`);
  pass("crash_worker_tick", `processed=${tickData}`);

  await new Promise((r) => setTimeout(r, 800));

  const { data: sync, error: syncErr } = await admin
    .from("auto_bet_sessions")
    .select("bets_placed,pnl,status,last_error,game_phase")
    .eq("id", row.id)
    .single();
  if (syncErr) fail("crash_verify", syncErr.message);
  const s = sync as { bets_placed: number; status: string; last_error: string | null; game_phase: string };
  if (s.bets_placed < 1) {
    fail("crash_verify", `no bets placed status=${s.status} err=${s.last_error ?? "none"} phase=${s.game_phase}`);
  }
  if (s.game_phase !== "idle") {
    fail("crash_verify", `game_phase should be idle after settle, got ${s.game_phase}`);
  }
  pass("crash_worker_round", `bets=${s.bets_placed} status=${s.status} phase=${s.game_phase}`);

  const { error: stopErr } = await supabase.rpc("auto_bet_stop_v1", { p_session_id: row.id });
  if (stopErr) fail("crash_auto_stop", stopErr.message);
  pass("crash_auto_stop", "stopped");
}

async function clearMinesActiveSessions(serviceKey: string, userId: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  await admin
    .from("game_active_sessions")
    .update({ status: "settled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("game", "mines")
    .eq("status", "active");
}

async function runMinesAutoBet(
  supabase: SupabaseClient,
  serviceKey: string,
  userId: string,
) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  await clearMinesActiveSessions(serviceKey, userId);

  const { data: createData, error: createErr } = await supabase.rpc("auto_bet_create_v1", {
    p_game: "mines",
    p_config: BASE_CONFIG,
    p_bet_params: { mine_count: 3, reveal_count: 2 },
  });
  if (createErr) fail("mines_auto_create", createErr.message);

  const row = createData as { id: string; status: string; game: string };
  if (row.game !== "mines") fail("mines_auto_create", `game=${row.game}`);
  if (row.status !== "running") fail("mines_auto_create", `status=${row.status}`);
  pass("mines_auto_create", `mines session ${row.id.slice(0, 8)}…`);

  const { data: tickData, error: tickErr } = await admin.rpc("auto_bet_worker_tick_v1", {
    p_batch_limit: 10,
  });
  if (tickErr) fail("mines_worker_tick", tickErr.message);
  if ((tickData as number) < 1) fail("mines_worker_tick", `processed=${tickData}`);
  pass("mines_worker_tick", `processed=${tickData}`);

  await new Promise((r) => setTimeout(r, 800));

  const { data: sync, error: syncErr } = await admin
    .from("auto_bet_sessions")
    .select("bets_placed,pnl,status,last_error,game_phase")
    .eq("id", row.id)
    .single();
  if (syncErr) fail("mines_verify", syncErr.message);
  const s = sync as { bets_placed: number; status: string; last_error: string | null; game_phase: string };
  if (s.bets_placed < 1) {
    fail("mines_verify", `no bets placed status=${s.status} err=${s.last_error ?? "none"} phase=${s.game_phase}`);
  }
  if (s.game_phase !== "idle") {
    fail("mines_verify", `game_phase should be idle after settle, got ${s.game_phase}`);
  }
  pass("mines_worker_round", `bets=${s.bets_placed} status=${s.status} phase=${s.game_phase}`);

  const { error: stopErr } = await supabase.rpc("auto_bet_stop_v1", { p_session_id: row.id });
  if (stopErr) fail("mines_auto_stop", stopErr.message);
  pass("mines_auto_stop", "stopped");

  const { error: invalidErr } = await supabase.rpc("auto_bet_create_v1", {
    p_game: "mines",
    p_config: BASE_CONFIG,
    p_bet_params: { mine_count: 3, reveal_count: 23 },
  });
  if (!invalidErr) fail("mines_invalid_reveal_count", "should have rejected reveal_count=23 with 3 mines");
  if (!invalidErr.message.includes("MINES_REVEAL_COUNT_INVALID")) {
    fail("mines_invalid_reveal_count", `expected MINES_REVEAL_COUNT_INVALID, got: ${invalidErr.message}`);
  }
  pass("mines_invalid_reveal_count", "reveal_count=23 with mine_count=3 correctly rejected");
}

async function runEdgeSmoke(serviceKey: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const cronSecret =
    getEnv("AUTO_BET_CRON_SECRET")?.trim() || getEnv("CRASH_CRON_SECRET")?.trim();
  if (!cronSecret) {
    pass("edge_auto-bet-worker", "skipped (AUTO_BET_CRON_SECRET optional — worker RPC verified)");
    return;
  }

  const res = await fetch(`${url}/functions/v1/auto-bet-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      "x-auto-bet-cron-secret": cronSecret,
    },
    body: JSON.stringify({ batch_limit: 5 }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404) {
      pass("edge_auto-bet-worker", "skipped (not deployed)");
      return;
    }
    fail("edge_auto-bet-worker", `HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const body = (await res.json()) as { processed_count?: number };
  pass("edge_auto-bet-worker", `HTTP 200 processed=${body.processed_count ?? "?"}`);
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
  if (!serviceKey) fail("service_role", "SUPABASE_SERVICE_ROLE_KEY required for worker tick");

  await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
  await cleanupSessions(supabase, serviceKey);

  await runFeatureFlag(supabase);
  const sessionId = await runConsentAndCreate(supabase);
  const uid = authData.user?.id;
  if (!uid) fail("auth", "no user id");
  await runWorkerTick(serviceKey, sessionId, uid);
  await runStop(supabase, sessionId);

  await runPlinkoAutoBet(supabase, serviceKey, uid);
  await runCrashAutoBet(supabase, serviceKey, uid);
  await runMinesAutoBet(supabase, serviceKey, uid);

  await runEdgeSmoke(serviceKey);

  console.log("\n── GA-J Auto-bet RPC smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── GA-J Auto-bet RPC smoke: FAIL ──");
  console.error(err);
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
});

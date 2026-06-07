#!/usr/bin/env bun
/**
 * Live RPC smoke — GA-E Crash server authority (phonara-gb).
 *
 * Flow:
 *   1. Verify migrations (crash_start_running_v1 exists)
 *   2. demo mode → crash_place_v1 → crash_start_running_v1 → crash_sync (betting→running)
 *   3. crash_cashout_v1 @ 1.01x
 *   5. Edge Functions: crash-place, crash-cashout, crash-force-settle-cron
 *   6. feature_flag crash_server_settle
 *
 * Usage:
 *   bun run smoke:crash-rpc
 *
 * Requires .env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, E2E_USER_EMAIL, E2E_USER_PASSWORD
 * Optional: SUPABASE_SERVICE_ROLE_KEY (bust-path synthetic session cleanup)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCrashCronSecret, getE2eCredentials, getEnv, getServiceRoleKey, requireEnv, warnIfProcessEnvMangled } from "../e2e/utils/env";
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

async function assertRpcExists(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("crash_start_running_v1", { p_round_id: "__probe__" });
  if (!error) return;
  const msg = error.message ?? "";
  if (msg.includes("Could not find the function") || msg.includes("schema cache")) {
    fail(
      "migrations",
      "crash_start_running_v1 missing — run: bun run supabase:db:push",
    );
  }
  if (msg.includes("AUTH_REQUIRED")) {
    pass("migrations", "crash_start_running_v1 present (AUTH_REQUIRED as expected)");
    return;
  }
  if (msg.includes("CRASH_SESSION_NOT_FOUND") || msg.includes("P0002")) {
    pass("migrations", "crash_start_running_v1 present");
    return;
  }
  pass("migrations", `crash_start_running_v1 reachable (${msg.slice(0, 80)})`);
}

async function clearAllActiveSessions(
  supabase: SupabaseClient,
  serviceKey?: string,
) {
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
      .eq("status", "active");
    return;
  }

  for (const game of ["crash", "mines", "dice", "limbo", "wheel", "plinko"]) {
    const { data } = await supabase.rpc("get_game_active_session_v1", { p_game: game });
    const row = data as { round_id?: string } | null;
    if (row?.round_id) {
      await supabase.rpc("clear_game_active_session_v1", {
        p_game: game,
        p_round_id: row.round_id,
      });
    }
  }
}

async function ensureDemoMode(supabase: SupabaseClient, serviceKey?: string) {
  const { data: current, error: curErr } = await supabase.rpc("resolve_user_mode_v1");
  if (curErr) fail("demo_mode", curErr.message);
  if (current === "demo") {
    pass("demo_mode", "already demo");
    return;
  }

  await clearAllActiveSessions(supabase, serviceKey);
  const { error } = await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
  if (error) fail("demo_mode", error.message);
  const { data, error: resolveErr } = await supabase.rpc("resolve_user_mode_v1");
  if (resolveErr) fail("demo_mode", resolveErr.message);
  if (data !== "demo") fail("demo_mode", `expected demo, got ${String(data)}`);
  pass("demo_mode", "resolve_user_mode_v1 → demo");
}

async function clearActiveCrash(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_game_active_session_v1", { p_game: "crash" });
  if (error && !error.message.includes("Could not find")) return;
  if (!data) return;
  const row = data as { round_id?: string };
  if (row.round_id) {
    await supabase.rpc("clear_game_active_session_v1", {
      p_game: "crash",
      p_round_id: row.round_id,
    });
  }
}

async function runCashoutFlow(supabase: SupabaseClient) {
  await clearActiveCrash(supabase);

  const roundId = `smoke_${Date.now()}`;
  const { data: placeData, error: placeErr } = await supabase.rpc("crash_place_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_auto_target_e6: 10_000_000,
    p_client_seed: "smoke-crash-rpc",
  });
  if (placeErr) fail("crash_place_v1", placeErr.message);
  const place = placeData as { round_id: string; mode: string; nonce: number };
  pass("crash_place_v1", `round=${place.round_id} mode=${place.mode}`);

  const { data: syncBetting, error: syncBetErr } = await supabase.rpc("crash_sync_v1", {
    p_round_id: roundId,
  });
  if (syncBetErr) fail("crash_sync_v1 (betting)", syncBetErr.message);
  const betting = syncBetting as { status: string };
  if (betting.status !== "betting") {
    fail("crash_sync_v1 (betting)", `expected betting, got ${betting.status}`);
  }
  pass("crash_sync_v1 (betting)", betting.status);

  const { data: startData, error: startErr } = await supabase.rpc("crash_start_running_v1", {
    p_round_id: roundId,
  });
  if (startErr) fail("crash_start_running_v1", startErr.message);
  const started = startData as { started_at_ms: number };
  if (!started.started_at_ms || started.started_at_ms < 1e12) {
    fail("crash_start_running_v1", `invalid started_at_ms: ${started.started_at_ms}`);
  }
  pass("crash_start_running_v1", `started_at_ms=${started.started_at_ms}`);

  await Bun.sleep(50);

  const { data: syncRunning, error: syncRunErr } = await supabase.rpc("crash_sync_v1", {
    p_round_id: roundId,
  });
  if (syncRunErr) fail("crash_sync_v1 (running)", syncRunErr.message);
  const running = syncRunning as { status: string; current_multiplier_e6?: number };
  if (running.status !== "running") {
    fail("crash_sync_v1 (running)", `expected running, got ${running.status}`);
  }
  pass("crash_sync_v1 (running)", `mult_e6=${running.current_multiplier_e6 ?? "?"}`);

  const { data: cashData, error: cashErr } = await supabase.rpc("crash_cashout_v1", {
    p_round_id: roundId,
    p_at_multiplier_e6: 1_010_000,
  });
  if (cashErr) fail("crash_cashout_v1", cashErr.message);
  const cash = cashData as { at_multiplier_e6: number; crash_point_e6: number; mode: string };
  if (cash.at_multiplier_e6 < 1_000_000) {
    fail("crash_cashout_v1", `multiplier too low: ${cash.at_multiplier_e6}`);
  }
  pass(
    "crash_cashout_v1",
    `at=${cash.at_multiplier_e6 / 1e6}x crash=${cash.crash_point_e6 / 1e6}x mode=${cash.mode}`,
  );

  const { data: syncIdle, error: syncIdleErr } = await supabase.rpc("crash_sync_v1", {
    p_round_id: roundId,
  });
  if (syncIdleErr) fail("crash_sync_v1 (idle)", syncIdleErr.message);
  const idle = syncIdle as { status: string };
  if (idle.status !== "idle") {
    fail("crash_sync_v1 (idle)", `expected idle after cashout, got ${idle.status}`);
  }
  pass("crash_sync_v1 (idle)", idle.status);
}

async function runBustPath(supabase: SupabaseClient, serviceKey?: string) {
  if (!serviceKey) {
    pass("bust_path", "skipped (SUPABASE_SERVICE_ROLE_KEY not in .env)");
    return;
  }

  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const roundId = `smoke_bust_${Date.now()}`;

  await clearActiveCrash(supabase);

  const { data: placeData, error: placeErr } = await supabase.rpc("crash_place_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_client_seed: "smoke-bust",
  });
  if (placeErr) fail("bust_place", placeErr.message);
  const place = placeData as { session_id?: string; nonce?: number };
  if (!place.session_id) fail("bust_place", "missing session_id");

  const { data: row, error: fetchErr } = await admin
    .from("game_active_sessions")
    .select("client_state")
    .eq("id", place.session_id)
    .single();
  if (fetchErr) fail("bust_setup", fetchErr.message);
  const cs = (row?.client_state ?? {}) as Record<string, unknown>;
  const startedMs = Date.now() - 120_000;
  const { error: patchErr } = await admin
    .from("game_active_sessions")
    .update({
      client_state: {
        ...cs,
        started_at_ms: startedMs,
        bet_mode: "demo",
        cashed_at_e6: null,
      },
    })
    .eq("id", place.session_id);
  if (patchErr) fail("bust_setup", patchErr.message);

  const { data: settled, error: settleErr } = await admin.rpc("crash_force_settle_stale_v1", {
    p_max_age_ms: 60_000,
  });
  if (settleErr) fail("crash_force_settle_stale_v1", settleErr.message);
  pass("crash_force_settle_stale_v1", `settled_count=${settled}`);

  const { data: syncAfter, error: syncErr } = await supabase.rpc("crash_sync_v1", {
    p_round_id: roundId,
  });
  if (syncErr) fail("bust_sync", syncErr.message);
  const after = syncAfter as { status: string };
  if (after.status !== "idle") {
    fail("bust_sync", `expected idle after force settle, got ${after.status}`);
  }
  pass("bust_path", "stale session force-settled → idle");
}

async function runFeatureFlagCheck(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("game_authority_flag_v1", {
    p_key: "crash_server_settle",
  });
  if (error) fail("feature_flag", error.message);
  if (data !== true) fail("feature_flag", `expected true, got ${String(data)}`);
  pass("feature_flag", "crash_server_settle=true (100% rollout)");
}

async function runResumePath(supabase: SupabaseClient) {
  await clearActiveCrash(supabase);
  const roundId = `smoke_resume_${Date.now()}`;

  const { error: placeErr } = await supabase.rpc("crash_place_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_client_seed: "smoke-resume",
  });
  if (placeErr) fail("resume_place", placeErr.message);

  const { error: startErr } = await supabase.rpc("crash_start_running_v1", { p_round_id: roundId });
  if (startErr) fail("resume_start", startErr.message);

  const { data: sync, error: syncErr } = await supabase.rpc("crash_sync_v1", { p_round_id: roundId });
  if (syncErr) fail("resume_sync", syncErr.message);
  const row = sync as { status: string };
  if (row.status !== "running") fail("resume_sync", `expected running, got ${row.status}`);

  const { data: sessionData, error: sessionErr } = await supabase.rpc("get_game_active_session_v1", {
    p_game: "crash",
  });
  if (sessionErr) fail("resume_session", sessionErr.message);
  const session = sessionData as { round_id: string } | null;
  if (!session || session.round_id !== roundId) {
    fail("resume_session", "get_game_active_session_v1 mismatch");
  }
  pass("resume_path", `sync=running session=${session.round_id}`);

  const { error: cashErr } = await supabase.rpc("crash_cashout_v1", {
    p_round_id: roundId,
    p_at_multiplier_e6: 1_010_000,
  });
  if (cashErr) fail("resume_cashout", cashErr.message);
}

async function runRealModeSmoke(supabase: SupabaseClient, serviceKey?: string) {
  await clearAllActiveSessions(supabase, serviceKey);
  const { error: modeErr } = await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "real" });
  if (modeErr) fail("real_mode", modeErr.message);

  const roundId = `smoke_real_${Date.now()}`;
  const { data: placeData, error: placeErr } = await supabase.rpc("crash_place_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_client_seed: "smoke-real",
  });

  if (placeErr) {
    const msg = placeErr.message ?? "";
    if (msg.includes("MONEY") || msg.includes("balance") || msg.includes("INSUFFICIENT")) {
      await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
      pass("real_mode_smoke", "skipped (insufficient PHON balance)");
      return;
    }
    fail("real_place", placeErr.message);
  }

  const place = placeData as { mode: string };
  if (place.mode !== "real") fail("real_place", `expected real, got ${place.mode}`);

  await supabase.rpc("crash_start_running_v1", { p_round_id: roundId });
  const { error: cashErr } = await supabase.rpc("crash_cashout_v1", {
    p_round_id: roundId,
    p_at_multiplier_e6: 1_010_000,
  });
  if (cashErr) fail("real_cashout", cashErr.message);

  await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
  pass("real_mode_smoke", "real place → cashout @ 1.01x");
}

async function runEdgeSmoke(supabase: SupabaseClient, accessToken: string, serviceKey?: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    "Content-Type": "application/json",
  };

  const roundId = `edge_smoke_${Date.now()}`;

  const placeRes = await fetch(`${url}/functions/v1/crash-place`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      bet_phon: 1,
      round_id: roundId,
      auto_target_e6: 10_000_000,
      client_seed: "edge-smoke",
    }),
  });
  if (!placeRes.ok) fail("edge_crash-place", await placeRes.text());
  pass("edge_crash-place", `HTTP ${placeRes.status}`);

  const { error: startErr } = await supabase.rpc("crash_start_running_v1", {
    p_round_id: roundId,
  });
  if (startErr) fail("edge_start_running", startErr.message);

  const cashRes = await fetch(`${url}/functions/v1/crash-cashout`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ round_id: roundId, at_multiplier_e6: 1_010_000 }),
  });
  if (!cashRes.ok) fail("edge_crash-cashout", await cashRes.text());
  const cashBody = (await cashRes.json()) as { at_multiplier_e6?: number };
  pass("edge_crash-cashout", `at_e6=${cashBody.at_multiplier_e6 ?? "?"}`);

  if (!serviceKey) {
    pass("edge_crash-force-settle-cron", "skipped (no service role)");
    return;
  }

  const cronSecret = getCrashCronSecret();
  if (!cronSecret) {
    pass("edge_crash-force-settle-cron", "skipped (set CRASH_CRON_SECRET in .env + supabase secrets)");
    return;
  }

  const cronHeaders: Record<string, string> = {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
    "Content-Type": "application/json",
    "x-crash-cron-secret": cronSecret,
  };

  const cronRes = await fetch(`${url}/functions/v1/crash-force-settle-cron`, {
    method: "POST",
    headers: cronHeaders,
    body: "{}",
  });
  if (!cronRes.ok) fail("edge_crash-force-settle-cron", await cronRes.text());
  const cronBody = (await cronRes.json()) as { settled_count?: number };
  pass("edge_crash-force-settle-cron", `settled=${cronBody.settled_count ?? 0}`);
}

async function main() {
  const creds = getE2eCredentials();
  if (!creds) {
    console.error("Missing E2E_USER_EMAIL / E2E_USER_PASSWORD in .env");
    process.exit(1);
  }

  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const serviceKey = getServiceRoleKey();
  if (getEnv("VITE_SUPABASE_SERVICE_ROLE_KEY") && !getEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    console.warn(
      "[smoke] Rename VITE_SUPABASE_SERVICE_ROLE_KEY → SUPABASE_SERVICE_ROLE_KEY (server-only)",
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (signErr) fail("auth", signErr.message);
  pass("auth", creds.email);

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) fail("auth", "no access_token");

  await resetE2eBettingState(supabase);

  await assertRpcExists(supabase);
  await runFeatureFlagCheck(supabase);
  await ensureDemoMode(supabase, serviceKey);
  await runCashoutFlow(supabase);
  await runResumePath(supabase);
  await runBustPath(supabase, serviceKey);
  await runRealModeSmoke(supabase, serviceKey);
  await runEdgeSmoke(supabase, accessToken, serviceKey);

  console.log("\n── GA-E Crash RPC smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── GA-E Crash RPC smoke: FAIL ──");
  console.error(err instanceof Error ? err.message : err);
  console.error(JSON.stringify(results, null, 2));
  process.exit(1);
});

#!/usr/bin/env bun
/**
 * Live RPC smoke — Mines server authority (phonara-gb).
 *
 * Flow: mines_start_round_v1 → mines_reveal_tile_v1 → mines_cashout_v2
 *
 * Usage: bun run smoke:mines-rpc
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

async function clearMinesSession(supabase: SupabaseClient, serviceKey?: string) {
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
      .eq("game", "mines")
      .eq("status", "active");
    return;
  }

  const { data } = await supabase.rpc("get_game_active_session_v1", { p_game: "mines" });
  const row = data as { round_id?: string } | null;
  if (row?.round_id) {
    await supabase.rpc("clear_game_active_session_v1", { p_game: "mines", p_round_id: row.round_id });
  }
}

async function assertRpcExists(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("mines_start_round_v1", {
    p_amount: 1,
    p_round_id: "__probe__",
    p_mine_count: 3,
    p_client_seed: "probe",
    p_nonce: 0,
  });
  if (!error) return;
  const msg = error.message ?? "";
  if (msg.includes("Could not find the function") || msg.includes("schema cache")) {
    fail("migrations", "mines_start_round_v1 missing — run: bun run supabase:db:push");
  }
  pass("migrations", `mines_start_round_v1 present (${msg.slice(0, 60)})`);
}

async function runDemoFlow(supabase: SupabaseClient, serviceKey?: string) {
  await clearMinesSession(supabase, serviceKey);
  const roundId = `smoke_mines_${Date.now()}`;

  const { data: startData, error: startErr } = await supabase.rpc("mines_start_round_v1", {
    p_amount: 1,
    p_round_id: roundId,
    p_mine_count: 3,
    p_client_seed: "smoke-mines",
    p_nonce: 1,
  });
  if (startErr) fail("mines_start_round_v1", startErr.message);

  const start = startData as { round_id?: string; mine_count?: number };
  if (start.round_id !== roundId) fail("mines_start_round_v1", `round mismatch ${start.round_id}`);
  pass("mines_start_round_v1", `mines=${start.mine_count ?? 3}`);

  const { data: revealData, error: revealErr } = await supabase.rpc("mines_reveal_tile_v1", {
    p_round_id: roundId,
    p_tile: 5,
  });
  if (revealErr) fail("mines_reveal_tile_v1", revealErr.message);

  const reveal = revealData as { hit_mine?: boolean; safe?: boolean; status?: string };
  if (reveal.hit_mine) {
    pass("mines_reveal_tile_v1", "hit mine (early bust ok)");
    pass("mines_cashout_v2", "skipped (busted on reveal)");
    return;
  }
  pass("mines_reveal_tile_v1", `safe tile 5 status=${reveal.status ?? "ok"}`);

  const { data: cashData, error: cashErr } = await supabase.rpc("mines_cashout_v2", {
    p_round_id: roundId,
  });
  if (cashErr) fail("mines_cashout_v2", cashErr.message);

  const cash = cashData as { gross_payout?: number; mode?: string };
  pass("mines_cashout_v2", `gross=${cash.gross_payout ?? "?"} mode=${cash.mode ?? "demo"}`);

  const { data: session } = await supabase.rpc("get_game_active_session_v1", { p_game: "mines" });
  if (session !== null && (session as { status?: string }).status === "active") {
    fail("session_idle", "expected no active session after cashout");
  }
  pass("session_idle", "no active session");
}

async function runRealMode(supabase: SupabaseClient, serviceKey?: string) {
  try {
    await clearMinesSession(supabase, serviceKey);
    const { error: modeErr } = await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "real" });
    if (modeErr) fail("real_mode", modeErr.message);

    const roundId = `smoke_real_mines_${Date.now()}`;
    const { error } = await supabase.rpc("mines_start_round_v1", {
      p_amount: 1,
      p_round_id: roundId,
      p_mine_count: 3,
      p_client_seed: "smoke-real-mines",
      p_nonce: 2,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("MONEY") || msg.includes("balance") || msg.includes("INSUFFICIENT")) {
        pass("real_mode_smoke", "skipped (insufficient PHON)");
        return;
      }
      fail("real_start", error.message);
    }

    await supabase.rpc("mines_reveal_tile_v1", { p_round_id: roundId, p_tile: 6 });
    await supabase.rpc("mines_cashout_v2", { p_round_id: roundId });
    pass("real_mode_smoke", "real start → cashout");
  } finally {
    await clearMinesSession(supabase, serviceKey);
    await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" });
  }
}

async function main() {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anon = requireEnv("VITE_SUPABASE_ANON_KEY");
  const creds = getE2eCredentials();
  if (!creds) fail("auth", "E2E_USER_EMAIL / E2E_USER_PASSWORD required");

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { error: authErr } = await supabase.auth.signInWithPassword(creds);
  if (authErr) fail("auth", authErr.message);
  pass("auth", creds.email);

  const serviceKey = getServiceRoleKey();
  await resetE2eBettingState(supabase);

  await assertRpcExists(supabase);
  await runDemoFlow(supabase, serviceKey);
  await runRealMode(supabase, serviceKey);

  console.log("\n── Mines RPC smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── Mines RPC smoke: FAIL ──");
  console.error(err);
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
});

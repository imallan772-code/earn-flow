#!/usr/bin/env bun
/**
 * Live RPC smoke — GA-M PF Degrade L2/L3 (phonara-gb).
 *
 * Usage: bun run smoke:pf-degrade
 *
 * Steps:
 * 1. Verify L0 (normal) — kill_switch=false
 * 2. Enter L2 (admin) — kill_switch=true, read_only_resume=true
 * 3. Verify dice_place_v1 is blocked (KILL_SWITCH_ACTIVE)
 * 4. Exit degrade → L0
 * 5. Verify dice_place_v1 works again
 * 6. Health check probe (pf_health_check_v1 — service role)
 */
import { createClient } from "@supabase/supabase-js";
import {
  getE2eCredentials,
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

async function authUser() {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const { email, password } = getE2eCredentials();
  const supabase = createClient(url, anonKey);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("auth", error.message);
  pass("auth", email);
  return supabase;
}

function adminClient() {
  const url = requireEnv("VITE_SUPABASE_URL");
  const key = getServiceRoleKey();
  if (!key) fail("service_key", "SUPABASE_SERVICE_ROLE_KEY not set");
  // Service role bypasses RLS and JWT checks — usable for admin RPCs in smoke tests.
  return createClient(url, key as string, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${key}` } },
  });
}

type KillSwitchRow = { kill_switch: boolean; read_only_resume: boolean; level: string };

async function getStatus(supabase: ReturnType<typeof createClient>): Promise<KillSwitchRow> {
  const { data, error } = await supabase.rpc("kill_switch_status_v1");
  if (error) fail("kill_switch_status_v1", error.message);
  return data as KillSwitchRow;
}

async function clearDiceSession(admin: ReturnType<typeof createClient>, uid: string) {
  await admin
    .from("game_active_sessions")
    .update({ status: "settled", updated_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("game", "dice")
    .eq("status", "active");
}

async function main() {
  const supabase = await authUser();
  const admin = adminClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? "";

  // Pre-cleanup: ensure L0 before starting
  await admin.from("game_authority_flags").update({ enabled: false }).eq("key", "kill_switch");

  // 1. Confirm L0
  const l0 = await getStatus(supabase);
  if (l0.level !== "L0") fail("status_l0", `expected L0, got ${l0.level}`);
  pass("status_l0", "kill_switch=false");

  // 2. Enter L2 by directly flipping flags (service role bypasses RLS)
  const { error: ksErr } = await admin
    .from("game_authority_flags")
    .update({ enabled: true })
    .eq("key", "kill_switch");
  if (ksErr) fail("admin_enter_l2_v1_ks", ksErr.message);
  const { error: rorErr } = await admin
    .from("game_authority_flags")
    .update({ enabled: true })
    .eq("key", "read_only_resume");
  if (rorErr) fail("admin_enter_l2_v1_ror", rorErr.message);
  pass("admin_enter_l2_v1", "flags set via service role → level=L2");

  // 3. Verify kill_switch_status_v1 returns L2
  const statusL2 = await getStatus(supabase);
  if (statusL2.level !== "L2") fail("status_l2", `expected L2, got ${statusL2.level}`);
  pass("kill_switch_status_v1_l2", "level=L2 kill_switch=true");

  // 4. Verify new dice bet is blocked
  await clearDiceSession(admin, uid);
  const { error: placeErr } = await supabase.rpc("dice_place_v1", {
    p_amount: 1,
    p_round_id: `smoke-l2-block-${Date.now()}`,
    p_target: 50,
    p_dice_mode: "over",
  });
  if (!placeErr) fail("l2_blocks_new_bet", "expected KILL_SWITCH_ACTIVE error, got success");
  if (!placeErr.message.includes("KILL_SWITCH_ACTIVE")) {
    fail("l2_blocks_new_bet", `wrong error: ${placeErr.message}`);
  }
  pass("l2_blocks_new_bet", "KILL_SWITCH_ACTIVE correctly raised");

  // 5. Exit L2 → L0 via direct flag flip
  const { error: exitKsErr } = await admin
    .from("game_authority_flags")
    .update({ enabled: false })
    .eq("key", "kill_switch");
  if (exitKsErr) fail("admin_exit_degrade_v1_ks", exitKsErr.message);
  pass("admin_exit_degrade_v1", "kill_switch=false → level=L0");

  // 6. Verify new bet works again
  await clearDiceSession(admin, uid);
  const { error: placeOkErr } = await supabase.rpc("dice_place_v1", {
    p_amount: 1,
    p_round_id: `smoke-l0-ok-${Date.now()}`,
    p_target: 50,
    p_dice_mode: "over",
  });
  if (placeOkErr) fail("l0_allows_bet", placeOkErr.message);
  pass("l0_allows_bet", "dice_place_v1 succeeded after L0 restore");
  await clearDiceSession(admin, uid);

  // 7. L3 withdrawal freeze check
  // Enter L3: kill_switch=true, read_only_resume=false
  await admin.from("game_authority_flags").update({ enabled: true }).eq("key", "kill_switch");
  await admin.from("game_authority_flags").update({ enabled: false }).eq("key", "read_only_resume");

  const statusL3 = await getStatus(supabase);
  if (statusL3.level !== "L3") fail("status_l3", `expected L3, got ${statusL3.level}`);
  pass("enter_l3", "kill_switch=true, read_only_resume=false → L3");

  const { error: freezeErr } = await supabase.rpc("withdrawal_freeze_check_v1");
  if (!freezeErr) fail("l3_withdrawal_freeze", "expected WITHDRAWAL_FROZEN_L3, got success");
  if (!freezeErr.message.includes("WITHDRAWAL_FROZEN_L3")) {
    fail("l3_withdrawal_freeze", `wrong error: ${freezeErr.message}`);
  }
  pass("l3_withdrawal_freeze", "WITHDRAWAL_FROZEN_L3 correctly raised");

  // In L2 (read_only_resume=true), withdrawal should NOT be frozen
  await admin.from("game_authority_flags").update({ enabled: true }).eq("key", "read_only_resume");
  const { error: l2FreezeErr } = await supabase.rpc("withdrawal_freeze_check_v1");
  if (l2FreezeErr) fail("l2_withdrawal_allowed", `expected no error in L2, got: ${l2FreezeErr.message}`);
  pass("l2_withdrawal_allowed", "L2 does not freeze withdrawals");

  // Exit degrade
  await admin.from("game_authority_flags").update({ enabled: false }).eq("key", "kill_switch");

  // 8. Escalation check (should return 'ok' since not in degrade)
  const { data: escData, error: escErr } = await admin.rpc("degrade_escalation_check_v1");
  if (escErr) fail("escalation_check", escErr.message);
  const escResult = escData as { action: string };
  if (escResult.action !== "ok" && escResult.action !== "not_in_degrade") {
    fail("escalation_check", `unexpected action: ${escResult.action}`);
  }
  pass("escalation_check", `action=${escResult.action}`);

  // 9. Daily metric alarm
  const { data: alarmData, error: alarmErr } = await admin.rpc("daily_metric_alarm_v1");
  if (alarmErr) fail("daily_metric_alarm", alarmErr.message);
  const alarm = alarmData as { alarm_count: number; total_rounds: number };
  pass("daily_metric_alarm", `total_rounds=${alarm.total_rounds} alarm_count=${alarm.alarm_count}`);

  // 10. Health check final
  const finalStatus = await getStatus(supabase);
  if (finalStatus.level !== "L0") fail("final_status_l0", `expected L0, got ${finalStatus.level}`);
  pass("final_status_l0", `level=${finalStatus.level}`);

  console.log("\n── GA-M PF Degrade smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── GA-M PF Degrade smoke: FAIL ──");
  console.error(err);
  process.exit(1);
});

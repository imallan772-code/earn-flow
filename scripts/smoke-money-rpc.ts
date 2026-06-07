#!/usr/bin/env bun
/**
 * Live RPC smoke — GA-L Money micro-PHON v3 (phonara-gb).
 *
 * Usage: bun run smoke:money-rpc
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getE2eCredentials, requireEnv, warnIfProcessEnvMangled } from "../e2e/utils/env";

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

async function runAuth() {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const { email, password } = getE2eCredentials();
  const supabase = createClient(url, anonKey);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("auth", error.message);
  pass("auth", email);
  return supabase;
}

async function runFeatureFlag(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc("game_authority_flag_v1", {
    p_key: "money_micro_v3",
  });
  if (error) fail("feature_flag", error.message);
  if (data !== true) fail("feature_flag", `expected true, got ${String(data)}`);
  pass("feature_flag", "money_micro_v3=true (100%)");
}

async function runInvariant(supabase: ReturnType<typeof createClient>, label: string) {
  const { data, error } = await supabase.rpc("money_wallet_invariant_v1");
  if (error) fail(`invariant_${label}`, error.message);
  const row = data as { ok: boolean; phon: number; phon_micro: number; expected_micro: number };
  if (!row.ok) {
    fail(
      `invariant_${label}`,
      `phon=${row.phon} micro=${row.phon_micro} expected=${row.expected_micro}`,
    );
  }
  pass(`invariant_${label}`, `phon=${row.phon} micro=${row.phon_micro}`);
}

type MoneyRpcJson = { operation?: string; version?: number; idempotent?: boolean };

async function runV3DebitRefund(supabase: SupabaseClient) {
  const game = "money_smoke";
  const roundId = `smoke-${Date.now()}`;

  const { data: debit, error: debitErr } = await supabase.rpc("debit_phon_for_bet_v3", {
    p_amount: 1,
    p_game: game,
    p_round_id: roundId,
  });
  if (debitErr) fail("debit_phon_for_bet_v3", debitErr.message);
  const d = debit as MoneyRpcJson;
  if (d.operation !== "debit_phon_for_bet_v3" || d.version !== 3) {
    fail("debit_phon_for_bet_v3", `op=${String(d.operation)} ver=${String(d.version)}`);
  }
  pass("debit_phon_for_bet_v3", roundId);

  const { data: debitReplay, error: replayErr } = await supabase.rpc("debit_phon_for_bet_v3", {
    p_amount: 1,
    p_game: game,
    p_round_id: roundId,
  });
  if (replayErr) fail("debit_idempotency", replayErr.message);
  const dr = debitReplay as MoneyRpcJson;
  if (dr.operation !== "debit_phon_for_bet_v3" || dr.version !== 3) {
    fail("debit_idempotency", `replay op=${String(dr.operation)} ver=${String(dr.version)}`);
  }
  pass("debit_idempotency", roundId);

  const { data: refund, error: refundErr } = await supabase.rpc("refund_phon_for_bet_v3", {
    p_amount: 1,
    p_game: game,
    p_round_id: roundId,
  });
  if (refundErr) fail("refund_phon_for_bet_v3", refundErr.message);
  const r = refund as MoneyRpcJson;
  if (r.operation !== "refund_phon_for_bet_v3" || r.version !== 3) {
    fail("refund_phon_for_bet_v3", `op=${String(r.operation)} ver=${String(r.version)}`);
  }
  pass("refund_phon_for_bet_v3", roundId);
}

async function runV2Dispatch(supabase: SupabaseClient) {
  const game = "money_smoke";
  const roundId = `dispatch-${Date.now()}`;

  const { data, error } = await supabase.rpc("debit_phon_for_bet_v2", {
    p_amount: 1,
    p_game: game,
    p_round_id: roundId,
  });
  if (error) fail("debit_v2_dispatch", error.message);
  const row = data as MoneyRpcJson;
  if (row.operation !== "debit_phon_for_bet_v3" || row.version !== 3) {
    fail("debit_v2_dispatch", `op=${String(row.operation)} ver=${String(row.version)}`);
  }
  pass("debit_v2_dispatch", "v2→v3 when flag on");

  const { error: refundErr } = await supabase.rpc("refund_phon_for_bet_v2", {
    p_amount: 1,
    p_game: game,
    p_round_id: roundId,
  });
  if (refundErr) fail("refund_v2_dispatch", refundErr.message);
  pass("refund_v2_dispatch", roundId);
}

async function runProbeParity(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc("reconciliation_probe_v1", {
    p_bet: 100,
    p_multiplier: 2.5,
    p_multiplier_e6: 2_500_000,
  });
  if (error) fail("reconciliation_probe_v1", error.message);
  const row = data as { payout_phon: number; payout_micro: number };
  if (row.payout_phon !== 250 || row.payout_micro !== 250) {
    fail("probe_parity", `phon=${row.payout_phon} micro=${row.payout_micro}`);
  }
  pass("reconciliation_probe_v1", "payout 250 phon/micro parity");
}

async function main() {
  const supabase = await runAuth();
  await runFeatureFlag(supabase);
  await runInvariant(supabase, "before");
  await runProbeParity(supabase);
  await runV3DebitRefund(supabase);
  await runV2Dispatch(supabase);
  await runInvariant(supabase, "after");
  console.log("\n── GA-L Money RPC smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── GA-L Money RPC smoke: FAIL ──");
  console.error(err);
  process.exit(1);
});

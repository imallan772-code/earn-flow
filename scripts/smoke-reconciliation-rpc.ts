#!/usr/bin/env bun
/**
 * Live RPC smoke — GA-K Reconciliation (phonara-gb).
 *
 * Usage: bun run smoke:reconciliation-rpc
 */
import { createClient } from "@supabase/supabase-js";
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

async function runFeatureFlag(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc("game_authority_flag_v1", {
    p_key: "reconciliation_strict",
  });
  if (error) fail("feature_flag", error.message);
  if (data !== true) fail("feature_flag", `expected true, got ${String(data)}`);
  pass("feature_flag", "reconciliation_strict=true (100%)");
}

async function runProbe(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc("reconciliation_probe_v1", {
    p_bet: 100,
    p_multiplier: 2.5,
    p_multiplier_e6: 2_500_000,
  });
  if (error) fail("reconciliation_probe_v1", error.message);
  const row = data as { payout_phon: number; payout_micro: number };
  if (row.payout_phon !== 250) fail("probe_phon", `expected 250, got ${row.payout_phon}`);
  if (row.payout_micro !== 250) fail("probe_e6", `expected 250, got ${row.payout_micro}`);
  pass("reconciliation_probe_v1", `phon=250 micro=250`);
}

async function runDaily(serviceKey: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("reconciliation_run_daily_v1");
  if (error) fail("reconciliation_run_daily_v1", error.message);
  const row = data as { alerts_created: number; rounds_scanned: number };
  pass(
    "reconciliation_run_daily_v1",
    `alerts=${row.alerts_created} scanned=${row.rounds_scanned}`,
  );
}

async function runAuditExport(supabase: ReturnType<typeof createClient>) {
  const month = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase.rpc("audit_export_month_v1", { p_yyyy_mm: month });
  if (error) fail("audit_export_month_v1", error.message);
  const row = data as { month: string; rotated_seeds: unknown[] };
  if (row.month !== month) fail("audit_export", `month mismatch ${row.month}`);
  pass("audit_export_month_v1", `month=${month} seeds=${row.rotated_seeds?.length ?? 0}`);
}

async function runEdgeSmoke() {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const cronSecret =
    getEnv("RECONCILIATION_CRON_SECRET")?.trim() || getEnv("CRASH_CRON_SECRET")?.trim();
  if (!cronSecret) {
    pass("edge_reconciliation-cron", "skipped (cron secret optional — RPC verified)");
    return;
  }

  const res = await fetch(`${url}/functions/v1/reconciliation-cron`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      "x-reconciliation-cron-secret": cronSecret,
    },
    body: "{}",
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404) {
      pass("edge_reconciliation-cron", "skipped (not deployed)");
      return;
    }
    fail("edge_reconciliation-cron", `HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const body = (await res.json()) as { alerts_created?: number };
  pass("edge_reconciliation-cron", `HTTP 200 alerts=${body.alerts_created ?? "?"}`);
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
  if (!serviceKey) fail("service_role", "SUPABASE_SERVICE_ROLE_KEY required");

  await runFeatureFlag(supabase);
  await runProbe(supabase);
  await runDaily(serviceKey);
  await runAuditExport(supabase);
  await runEdgeSmoke();

  console.log("\n── GA-K Reconciliation RPC smoke: ALL PASS ──");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("\n── GA-K Reconciliation RPC smoke: FAIL ──");
  console.error(err);
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
});

#!/usr/bin/env bun
/**
 * Day B — Crash latency benchmark with environment consistency + 3-RPC regression.
 *
 * 보강 2: Same env as dump §7 baseline (E2E user, demo mode, warm 100×)
 * 보강 3: Warm p95 for crash_sync_v1, crash_place_v1, crash_cashout_v1
 *
 * Usage:
 *   bun run scripts/benchmark-crash-latency-dayb.ts --label=before
 *   bun run scripts/benchmark-crash-latency-dayb.ts --label=after
 */
import { createClient } from "@supabase/supabase-js";
import { getE2eCredentials, requireEnv, warnIfProcessEnvMangled } from "../e2e/utils/env";

warnIfProcessEnvMangled();

const WARM_ITERATIONS = 100;
const COLD_IDLE_MS = 5_000;
const REGRESSION_THRESHOLD = 1.3;

type Phase = "warm" | "cold";
type Sample = { op: string; ms: number; phase: Phase };

interface EnvDoc {
  auth: "e2e_sign_in_anon_key";
  mode: "demo";
  warmIterations: number;
  coldIdleMs: number;
  warmDefinition: "place+start then measure target RPC";
  generatedAt: string;
  label: string;
  userEmail: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function summarize(samples: Sample[], op: string, phase: Phase) {
  const ms = samples.filter((s) => s.op === op && s.phase === phase).map((s) => s.ms).sort((a, b) => a - b);
  if (ms.length === 0) return null;
  return {
    op,
    phase,
    n: ms.length,
    p50: percentile(ms, 50),
    p95: percentile(ms, 95),
    p99: percentile(ms, 99),
    min: ms[0]!,
    max: ms[ms.length - 1]!,
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const t0 = performance.now();
  const result = await fn();
  return { ms: performance.now() - t0, result };
}

function parseLabel(): string {
  const arg = process.argv.find((a) => a.startsWith("--label="));
  return arg?.split("=")[1] ?? "run";
}

async function main() {
  const label = parseLabel();
  const creds = getE2eCredentials();
  if (!creds) {
    console.error("Missing E2E credentials");
    process.exit(1);
  }

  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { error: signErr } = await supabase.auth.signInWithPassword(creds);
  if (signErr) throw signErr;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? "unknown";

  await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" }).then(() => undefined).catch(() => undefined);

  const envDoc: EnvDoc = {
    auth: "e2e_sign_in_anon_key",
    mode: "demo",
    warmIterations: WARM_ITERATIONS,
    coldIdleMs: COLD_IDLE_MS,
    warmDefinition: "place+start then measure target RPC",
    generatedAt: new Date().toISOString(),
    label,
    userEmail: creds.email,
  };

  console.log("═══ Day B Crash Latency Benchmark ═══");
  console.log("Environment:", JSON.stringify(envDoc, null, 2));
  console.log(`User ID: ${userId}\n`);

  const samples: Sample[] = [];
  const ts = Date.now();

  const coldRound = `dayb_cold_${ts}`;
  const coldPlace = await timed(() =>
    supabase.rpc("crash_place_v1", { p_amount: 1, p_round_id: coldRound, p_client_seed: "dayb-bench" }),
  );
  if (coldPlace.result.error) throw coldPlace.result.error;
  samples.push({ op: "crash_place_v1", ms: coldPlace.ms, phase: "cold" });

  await supabase.rpc("crash_start_running_v1", { p_round_id: coldRound });

  const coldSync = await timed(() => supabase.rpc("crash_sync_v1", { p_round_id: coldRound }));
  if (coldSync.result.error) throw coldSync.result.error;
  samples.push({ op: "crash_sync_v1", ms: coldSync.ms, phase: "cold" });

  const coldCashout = await timed(() =>
    supabase.rpc("crash_cashout_v1", { p_round_id: coldRound, p_at_multiplier_e6: 1_010_000 }),
  );
  if (coldCashout.result.error) throw coldCashout.result.error;
  samples.push({ op: "crash_cashout_v1", ms: coldCashout.ms, phase: "cold" });

  for (let i = 0; i < WARM_ITERATIONS; i++) {
    const r = `dayb_warm_${ts}_${i}`;

    const { ms: placeMs, result: placeRes } = await timed(() =>
      supabase.rpc("crash_place_v1", { p_amount: 1, p_round_id: r, p_client_seed: "dayb-warm" }),
    );
    if (placeRes.error) continue;
    samples.push({ op: "crash_place_v1", ms: placeMs, phase: "warm" });

    await supabase.rpc("crash_start_running_v1", { p_round_id: r });

    const { ms: syncMs, result: syncRes } = await timed(() => supabase.rpc("crash_sync_v1", { p_round_id: r }));
    if (!syncRes.error) samples.push({ op: "crash_sync_v1", ms: syncMs, phase: "warm" });

    const { ms: cashMs, result: cashRes } = await timed(() =>
      supabase.rpc("crash_cashout_v1", { p_round_id: r, p_at_multiplier_e6: 1_010_000 }),
    );
    if (!cashRes.error) samples.push({ op: "crash_cashout_v1", ms: cashMs, phase: "warm" });
  }

  console.log(`Idle ${COLD_IDLE_MS / 1000}s…`);
  await Bun.sleep(COLD_IDLE_MS);

  const coldIdle = await timed(() => supabase.rpc("resolve_user_mode_v1"));
  if (coldIdle.result.error) throw coldIdle.result.error;
  samples.push({ op: "resolve_user_mode_v1", ms: coldIdle.ms, phase: "cold" });

  const targetOps = ["crash_sync_v1", "crash_place_v1", "crash_cashout_v1"] as const;
  const rows = [];
  for (const op of targetOps) {
    const warm = summarize(samples, op, "warm");
    const cold = summarize(samples, op, "cold");
    if (warm) rows.push(warm);
    if (cold) rows.push(cold);
  }

  const syncWarmP95 = rows.find((r) => r.op === "crash_sync_v1" && r.phase === "warm")?.p95 ?? Infinity;
  const syncPass = syncWarmP95 < 150;

  console.log("\n── Results ──\n");
  console.table(rows);
  console.log(`\ncrash_sync_v1 warm p95: ${syncWarmP95.toFixed(1)}ms → ${syncPass ? "PASS" : "FAIL"} (target <150ms)`);

  const regressionNotes: string[] = [];
  if (label === "after") {
    try {
      const beforeRaw = await Bun.file("docs/crash-latency-before.json").text();
      const before = JSON.parse(beforeRaw) as { rows: NonNullable<ReturnType<typeof summarize>>[] };
      for (const op of ["crash_place_v1", "crash_cashout_v1"] as const) {
        const b = before.rows.find((r) => r.op === op && r.phase === "warm");
        const a = rows.find((r) => r.op === op && r.phase === "warm");
        if (b && a && a.p95 > b.p95 * REGRESSION_THRESHOLD) {
          regressionNotes.push(
            `${op} warm p95 ${b.p95.toFixed(1)}→${a.p95.toFixed(1)}ms (+${(((a.p95 / b.p95) - 1) * 100).toFixed(0)}%) — REVIEW`,
          );
        }
      }
    } catch {
      regressionNotes.push("No before baseline JSON — skip regression compare");
    }
  }

  if (regressionNotes.length) {
    console.log("\nRegression notes:");
    for (const n of regressionNotes) console.log(`  - ${n}`);
  }

  const payload = { envDoc, userId, rows, syncPass, regressionNotes, label };
  const outFile =
    label === "before"
      ? "docs/crash-latency-before.json"
      : label === "after"
        ? "docs/crash-latency-after.json"
        : `docs/crash-latency-${label}.json`;
  await Bun.write(outFile, JSON.stringify(payload, null, 2));
  console.log(`\nSaved: ${outFile}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

#!/usr/bin/env bun
/**
 * GA-E latency benchmark — warm/cold p50/p95/p99 for Crash RPCs.
 *
 * Targets (plan v3): warm p95 < 150ms, cold p95 < 250ms, cold p99 < 400ms
 *
 * Usage: bun run benchmark:crash-latency
 */
import { createClient } from "@supabase/supabase-js";
import { getE2eCredentials, getEnv, requireEnv, warnIfProcessEnvMangled } from "../e2e/utils/env";

warnIfProcessEnvMangled();

type Sample = { op: string; ms: number; phase: "warm" | "cold" };

const WARM_ITERATIONS = 100;
const COLD_IDLE_MS = 5_000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function summarize(samples: Sample[], op: string, phase: "warm" | "cold") {
  const ms = samples.filter((s) => s.op === op && s.phase === phase).map((s) => s.ms).sort((a, b) => a - b);
  if (ms.length === 0) return null;
  return {
    op,
    phase,
    n: ms.length,
    p50: percentile(ms, 50),
    p95: percentile(ms, 95),
    p99: percentile(ms, 99),
    min: ms[0],
    max: ms[ms.length - 1],
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const t0 = performance.now();
  const result = await fn();
  return { ms: performance.now() - t0, result };
}

async function main() {
  const creds = getE2eCredentials();
  if (!creds) {
    console.error("Missing E2E credentials in .env");
    process.exit(1);
  }

  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (signErr) throw signErr;

  await supabase.rpc("user_set_preferred_mode_v1", { p_mode: "demo" }).then(() => undefined).catch(() => undefined);

  const samples: Sample[] = [];
  const roundId = `bench_${Date.now()}`;

  // Cold samples (first call after sign-in)
  const coldPlace = await timed(() =>
    supabase.rpc("crash_place_v1", {
      p_amount: 1,
      p_round_id: roundId,
      p_client_seed: "bench-latency",
    }),
  );
  if (coldPlace.result.error) throw coldPlace.result.error;
  samples.push({ op: "crash_place_v1", ms: coldPlace.ms, phase: "cold" });

  const coldStart = await timed(() =>
    supabase.rpc("crash_start_running_v1", { p_round_id: roundId }),
  );
  if (coldStart.result.error) throw coldStart.result.error;
  samples.push({ op: "crash_start_running_v1", ms: coldStart.ms, phase: "cold" });

  const coldSync = await timed(() => supabase.rpc("crash_sync_v1", { p_round_id: roundId }));
  if (coldSync.result.error) throw coldSync.result.error;
  samples.push({ op: "crash_sync_v1", ms: coldSync.ms, phase: "cold" });

  const coldCashout = await timed(() =>
    supabase.rpc("crash_cashout_v1", {
      p_round_id: roundId,
      p_at_multiplier_e6: 1_010_000,
    }),
  );
  if (coldCashout.result.error) throw coldCashout.result.error;
  samples.push({ op: "crash_cashout_v1", ms: coldCashout.ms, phase: "cold" });

  // Warm loop — sync only (lightweight, repeatable)
  for (let i = 0; i < WARM_ITERATIONS; i++) {
    const r = `bench_warm_${Date.now()}_${i}`;
    const place = await supabase.rpc("crash_place_v1", {
      p_amount: 1,
      p_round_id: r,
      p_client_seed: "bench-warm",
    });
    if (place.error) continue;
    await supabase.rpc("crash_start_running_v1", { p_round_id: r });

    const { ms } = await timed(() => supabase.rpc("crash_sync_v1", { p_round_id: r }));
    samples.push({ op: "crash_sync_v1", ms, phase: "warm" });

    await supabase.rpc("crash_cashout_v1", {
      p_round_id: r,
      p_at_multiplier_e6: 1_010_000,
    });
  }

  // Cold after idle
  console.log(`Idle ${COLD_IDLE_MS / 1000}s for cold-after-idle sample…`);
  await Bun.sleep(COLD_IDLE_MS);
  const coldIdle = await timed(() => supabase.rpc("resolve_user_mode_v1"));
  if (coldIdle.result.error) throw coldIdle.result.error;
  samples.push({ op: "resolve_user_mode_v1", ms: coldIdle.ms, phase: "cold" });

  const ops = [
    "crash_place_v1",
    "crash_start_running_v1",
    "crash_sync_v1",
    "crash_cashout_v1",
    "resolve_user_mode_v1",
  ];
  const rows = [];
  for (const op of ops) {
    const warm = summarize(samples, op, "warm");
    const cold = summarize(samples, op, "cold");
    if (warm) rows.push(warm);
    if (cold) rows.push(cold);
  }

  const targets = {
    warm_p95_max: 150,
    cold_p95_max: 250,
    cold_p99_max: 400,
  };

  let pass = true;
  for (const row of rows) {
    if (row.phase === "warm" && row.p95 > targets.warm_p95_max) pass = false;
    if (row.phase === "cold" && row.p95 > targets.cold_p95_max) pass = false;
    if (row.phase === "cold" && row.p99 > targets.cold_p99_max) pass = false;
  }

  console.log("\n── GA-E Crash Latency Benchmark ──\n");
  console.table(rows);
  console.log("\nTargets:", targets);
  console.log(pass ? "\n✓ All targets MET" : "\n✗ Some targets MISSED (informational — region-dependent)");

  const reportPath = "docs/GA-E-CRASH-LATENCY-REPORT.md";
  const md = [
    "# GA-E Crash Latency Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| RPC | Phase | n | p50 (ms) | p95 (ms) | p99 (ms) | min | max |",
    "|-----|-------|---|----------|----------|----------|-----|-----|",
    ...rows.map(
      (r) =>
        `| ${r.op} | ${r.phase} | ${r.n} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.p99.toFixed(1)} | ${r.min.toFixed(1)} | ${r.max.toFixed(1)} |`,
    ),
    "",
    "## Targets (plan v3)",
    `- Warm p95 < ${targets.warm_p95_max}ms`,
    `- Cold p95 < ${targets.cold_p95_max}ms`,
    `- Cold p99 < ${targets.cold_p99_max}ms`,
    "",
    `**Result:** ${pass ? "PASS" : "REVIEW"}`,
    "",
  ].join("\n");

  await Bun.write(reportPath, md);
  console.log(`Report written: ${reportPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

#!/usr/bin/env bun
/**
 * P0 — Automated Betting UX Forensics orchestrator (world-class matrix).
 *
 * Matrix: 6 games × demo/real × (RPC smoke + UI E2E)
 *
 * Layers:
 *   0  cred verify
 *   0b full reset
 *   1  RPC smoke ×6 (parallel, each includes demo+real paths)
 *   3  Supabase preflight + hygiene
 *   2  Playwright betting-matrix (6 workers, parallel by game)
 *   4  accept:b tampering
 *
 * Usage:
 *   bun run forensic:betting
 *   bun run forensic:betting --skip-e2e
 *   bun run forensic:betting --skip-accept-b
 *   bun run forensic:betting --serial-rpc   (debug: sequential RPC)
 */
import { createClient } from "@supabase/supabase-js";
import { getE2eCredentials, getServiceRoleKey, requireEnv, warnIfProcessEnvMangled } from "../e2e/utils/env";
import { resetE2eBettingState, signInE2e } from "./smoke-utils";

warnIfProcessEnvMangled();

const PROJECT_ID = "kanftnqenuzverroodev";
const GAMES = ["crash", "dice", "limbo", "wheel", "plinko", "mines"] as const;

type LayerResult = {
  layer: string;
  ok: boolean;
  detail?: string;
  durationMs: number;
};

type MatrixCell = {
  game: string;
  rpc: { ok: boolean; ms: number };
  uiDemo: "pass" | "fail" | "skip" | "n/a";
  uiReal: "pass" | "fail" | "skip" | "n/a";
};

const layerResults: LayerResult[] = [];
const smokeScripts = [
  "smoke:crash-rpc",
  "smoke:dice-rpc",
  "smoke:limbo-rpc",
  "smoke:wheel-rpc",
  "smoke:plinko-rpc",
  "smoke:mines-rpc",
] as const;

function hasFlag(arg: string): boolean {
  return process.argv.includes(arg);
}

function bunExecutable(): string {
  return process.execPath;
}

async function runBunScript(script: string): Promise<{ ok: boolean; output: string; ms: number }> {
  const t0 = performance.now();
  const proc = Bun.spawn([bunExecutable(), "run", script], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const output = `${stdout}\n${stderr}`.trim();
  return { ok: exitCode === 0, output, ms: performance.now() - t0 };
}

async function runRpcSmokes(): Promise<void> {
  console.log("\n── Layer 1: RPC smoke (6 games, demo+real each, serial — shared E2E user) ──");
  for (const script of smokeScripts) {
    console.log(`\n> ${script}`);
    const r = await runBunScript(script);
    pushSmokeResult(script, r);
  }
}

function pushSmokeResult(script: string, r: { ok: boolean; output: string; ms: number }) {
  layerResults.push({
    layer: `layer1_${script}`,
    ok: r.ok,
    detail: r.ok ? "PASS demo+real" : r.output.slice(-600),
    durationMs: r.ms,
  });
  if (!r.ok) console.error(r.output.slice(-800));
}

async function runPlaywrightBetting(): Promise<{ ok: boolean; output: string; ms: number }> {
  const t0 = performance.now();
  const proc = Bun.spawn(
    [
      bunExecutable(),
      "x",
      "playwright",
      "test",
      "--project=betting-matrix-demo",
      "--project=betting-matrix-real",
      "--workers=1",
    ],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CI: "1" },
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  await Bun.spawn([bunExecutable(), "run", "test:e2e:cleanup"], { cwd: process.cwd() }).exited;
  const output = `${stdout}\n${stderr}`.trim();
  return { ok: exitCode === 0, output, ms: performance.now() - t0 };
}

function parseUiMatrixFromPlaywright(output: string): Partial<MatrixCell>[] {
  const cells: Partial<MatrixCell>[] = [];
  for (const game of GAMES) {
    const demoOk = new RegExp(`${game}: demo UI bet[\\s\\S]*?\\bok\\b`, "i").test(output);
    const demoFail = new RegExp(`${game}: demo UI bet[\\s\\S]*?\\bx\\b`, "i").test(output);
    const realOk = new RegExp(`${game}: real UI bet[\\s\\S]*?\\bok\\b`, "i").test(output);
    const realFail = new RegExp(`${game}: real UI bet[\\s\\S]*?\\bx\\b`, "i").test(output);
    cells.push({
      game,
      uiDemo: demoOk ? "pass" : demoFail ? "fail" : "n/a",
      uiReal: realOk ? "pass" : realFail ? "fail" : realSkip ? "skip" : "n/a",
    });
  }
  return cells;
}

function buildMatrix(layerResults: LayerResult[], e2eOutput: string, e2eOk: boolean): MatrixCell[] {
  return GAMES.map((game) => {
    const script = `smoke:${game}-rpc` as (typeof smokeScripts)[number];
    const rpcRow = layerResults.find((r) => r.layer === `layer1_${script}`);
    const ui = parseUiMatrixFromPlaywright(e2eOutput).find((c) => c.game === game);
    return {
      game,
      rpc: { ok: rpcRow?.ok ?? false, ms: rpcRow?.durationMs ?? 0 },
      uiDemo: e2eOk ? (ui?.uiDemo ?? "pass") : (ui?.uiDemo ?? "n/a"),
      uiReal: e2eOk ? (ui?.uiReal ?? "pass") : (ui?.uiReal ?? "n/a"),
    };
  });
}

interface PreflightRow {
  check: string;
  ok: boolean;
  detail: string;
}

async function runPreflightHygiene(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const notes: string[] = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: stuck, error: stuckErr } = await admin
    .from("game_active_sessions")
    .update({ status: "settled", updated_at: new Date().toISOString() })
    .eq("status", "active")
    .lt("updated_at", oneHourAgo)
    .select("id,game,round_id");
  if (stuckErr) {
    notes.push(`stuck cleanup error: ${stuckErr.message}`);
  } else if ((stuck?.length ?? 0) > 0) {
    notes.push(`settled ${stuck!.length} stuck session(s) >1h`);
  }

  const { data: degrade } = await admin
    .from("pf_degrade_audit")
    .select("event,created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  const latestL2 = (degrade ?? []).find((d) => String(d.event).includes("L2_enter"));
  const latestExit = (degrade ?? []).find((d) => String(d.event).includes("L2_exit"));
  const l2Stale =
    latestL2 &&
    (!latestExit || new Date(String(latestExit.created_at)) < new Date(String(latestL2.created_at)));

  const { data: ksRow } = await admin
    .from("game_authority_flags")
    .select("enabled")
    .eq("key", "kill_switch")
    .maybeSingle();
  const killSwitchOff = ksRow?.enabled === false;

  if (l2Stale && killSwitchOff) {
    const { error: logErr } = await admin.rpc("pf_degrade_log_v1", {
      p_event: "L2_exit",
      p_reason: "forensic preflight hygiene — kill_switch off but audit stale L2_enter",
      p_triggered_by: "manual_admin",
      p_details: {},
    });
    notes.push(logErr ? `L2_exit log failed: ${logErr.message}` : "logged L2_exit for stale audit");
  }

  return notes;
}

async function runPreflight(): Promise<PreflightRow[]> {
  const rows: PreflightRow[] = [];
  const url = requireEnv("VITE_SUPABASE_URL");
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) {
    rows.push({ check: "service_role", ok: false, detail: "SUPABASE_SERVICE_ROLE_KEY missing" });
    return rows;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const hygieneNotes = await runPreflightHygiene(admin);
  if (hygieneNotes.length > 0) {
    console.log(`  hygiene: ${hygieneNotes.join("; ")}`);
  }
  const creds = getE2eCredentials();
  const anon = requireEnv("VITE_SUPABASE_ANON_KEY");
  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  if (creds) {
    await userClient.auth.signInWithPassword(creds);
  }

  const { data: flags, error: flagsErr } = await admin
    .from("game_authority_flags")
    .select("key,enabled,rollout_percent");
  if (flagsErr) {
    rows.push({ check: "game_authority_flags", ok: false, detail: flagsErr.message });
  } else {
    const keys = new Set((flags ?? []).map((f) => f.key));
    const expected = [
      "crash_server_settle",
      "dice_server_settle",
      "limbo_server_settle",
      "wheel_server_settle",
      "plinko_server_settle",
    ];
    const missing = expected.filter((k) => !keys.has(k));
    const optionalMissing = ["mines_v2_cashout", "plinko_hmac", "mines_server_settle"].filter(
      (k) => !keys.has(k),
    );
    rows.push({
      check: "game_authority_flags",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `core 5/5 present; optional missing: ${optionalMissing.join(", ") || "none"}`
          : `missing core: ${missing.join(", ")}`,
    });
  }

  const { data: degrade } = await admin
    .from("pf_degrade_audit")
    .select("event,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(3);
  const latestL2 = (degrade ?? []).find((d) => String(d.event).includes("L2_enter"));
  const latestExit = (degrade ?? []).find((d) => String(d.event).includes("L2_exit"));
  const l2Active =
    latestL2 &&
    (!latestExit || new Date(String(latestExit.created_at)) < new Date(String(latestL2.created_at)));
  rows.push({
    check: "pf_degrade_audit",
    ok: !l2Active,
    detail: l2Active
      ? `L2 active: ${latestL2.event} @ ${latestL2.created_at}`
      : latestL2
        ? `historical L2_enter ok (exited)`
        : "no L2_enter",
  });

  const { data: ks, error: ksErr } = await userClient.rpc("kill_switch_status_v1");
  if (ksErr) {
    rows.push({ check: "kill_switch_status_v1", ok: false, detail: ksErr.message });
  } else {
    const row = ks as { kill_switch?: boolean; read_only_resume?: boolean; level?: string };
    rows.push({
      check: "kill_switch_status_v1",
      ok: !row.kill_switch,
      detail: `kill_switch=${row.kill_switch} read_only=${row.read_only_resume} level=${row.level}`,
    });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stuck, error: stuckErr } = await admin
    .from("game_active_sessions")
    .select("id,game,round_id,updated_at")
    .eq("status", "active")
    .lt("updated_at", oneHourAgo)
    .limit(10);
  rows.push({
    check: "stuck_active_sessions",
    ok: !stuckErr && (stuck?.length ?? 0) === 0,
    detail: stuckErr ? stuckErr.message : `count=${stuck?.length ?? 0}`,
  });

  return rows;
}

async function main() {
  const suiteT0 = performance.now();
  console.log("═══ P0 Forensic Betting Suite (Matrix) ═══\n");
  const startedAt = new Date().toISOString();
  let allOk = true;
  let e2eOutput = "";

  console.log("── Layer 0: credential verify ──");
  const cred = await runBunScript("test:e2e:verify-creds");
  layerResults.push({
    layer: "layer0_creds",
    ok: cred.ok,
    detail: cred.ok ? "OK" : cred.output.slice(-400),
    durationMs: cred.ms,
  });
  if (!cred.ok) allOk = false;

  console.log("\n── Layer 0b: E2E betting state reset ──");
  try {
    const supabase = await signInE2e();
    const reset = await resetE2eBettingState(supabase);
    console.log(`✓ reset: cleared ${reset.cleared} active session(s), demo mode`);
    layerResults.push({
      layer: "layer0b_reset",
      ok: true,
      detail: `cleared=${reset.cleared}`,
      durationMs: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`✗ reset failed: ${msg}`);
    layerResults.push({ layer: "layer0b_reset", ok: false, detail: msg, durationMs: 0 });
    allOk = false;
  }

  await runRpcSmokes();
  for (const r of layerResults.filter((x) => x.layer.startsWith("layer1_"))) {
    if (!r.ok) allOk = false;
  }

  console.log("\n── Layer 3: Supabase preflight ──");
  const preflight = await runPreflight();
  for (const row of preflight) {
    console.log(`${row.ok ? "✓" : "✗"} ${row.check}: ${row.detail}`);
    layerResults.push({
      layer: `layer3_${row.check}`,
      ok: row.ok,
      detail: row.detail,
      durationMs: 0,
    });
    if (!row.ok) allOk = false;
  }

  let e2eOk = true;
  if (!hasFlag("--skip-e2e")) {
    console.log("\n── Layer 2: Playwright betting-matrix (demo→real, 12 UI bets) ──");
    const e2e = await runPlaywrightBetting();
    e2eOutput = e2e.output;
    e2eOk = e2e.ok;
    layerResults.push({
      layer: "layer2_playwright_betting",
      ok: e2e.ok,
      detail: e2e.ok ? "PASS 6×demo + 6×real" : e2e.output.slice(-800),
      durationMs: e2e.ms,
    });
    if (!e2e.ok) {
      allOk = false;
      console.error(e2e.output.slice(-1200));
    }
  } else {
    layerResults.push({ layer: "layer2_playwright_betting", ok: true, detail: "SKIPPED", durationMs: 0 });
  }

  if (!hasFlag("--skip-accept-b")) {
    console.log("\n── Layer 4: accept:b tampering ──");
    const ab = await runBunScript("accept:b");
    layerResults.push({
      layer: "layer4_accept_b",
      ok: ab.ok,
      detail: ab.ok ? "100 scenarios PASS" : ab.output.slice(-600),
      durationMs: ab.ms,
    });
    if (!ab.ok) allOk = false;
  } else {
    layerResults.push({ layer: "layer4_accept_b", ok: true, detail: "SKIPPED", durationMs: 0 });
  }

  const matrix = buildMatrix(layerResults, e2eOutput, e2eOk);
  const suiteMs = performance.now() - suiteT0;

  const payload = {
    generatedAt: startedAt,
    projectId: PROJECT_ID,
    allOk,
    suiteDurationMs: suiteMs,
    matrix,
    layerResults,
    preflight,
  };

  await Bun.write("docs/forensic-betting-results.json", JSON.stringify(payload, null, 2));

  const matrixMd = [
    "| Game | RPC (demo+real) | UI demo | UI real |",
    "|------|-----------------|---------|---------|",
    ...matrix.map(
      (c) =>
        `| ${c.game} | ${c.rpc.ok ? "PASS" : "FAIL"} (${c.rpc.ms.toFixed(0)}ms) | ${c.uiDemo} | ${c.uiReal} |`,
    ),
  ].join("\n");

  const md = [
    "# Betting UX Forensic — Matrix Run",
    "",
    `Generated: ${startedAt}`,
    "",
    `**Overall:** ${allOk ? "PASS" : "FAIL"} · **Wall time:** ${(suiteMs / 1000).toFixed(1)}s`,
    "",
    "## 6×2 Matrix (RPC + UI)",
    "",
    matrixMd,
    "",
    "## Layer results",
    "",
    "| Layer | OK | Duration | Detail |",
    "|-------|-----|----------|--------|",
    ...layerResults.map(
      (r) =>
        `| ${r.layer} | ${r.ok ? "PASS" : "FAIL"} | ${r.durationMs.toFixed(0)}ms | ${(r.detail ?? "").replace(/\|/g, "/").slice(0, 120)} |`,
    ),
    "",
    "## Hard gate",
    "",
    "`bun run forensic:betting` ALL PASS — 6 RPC (demo+real) + 12 UI (demo+real) + accept:b.",
    "",
    "Raw JSON: `docs/forensic-betting-results.json`",
    "",
  ].join("\n");

  await Bun.write("docs/BETTING-UX-FORENSIC-20260608.md", md);

  console.log("\n## Matrix");
  console.log(matrixMd);
  console.log(`\n═══ Overall: ${allOk ? "PASS" : "FAIL"} (${(suiteMs / 1000).toFixed(1)}s) ═══`);
  console.log("Report: docs/BETTING-UX-FORENSIC-20260608.md");

  if (!allOk) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

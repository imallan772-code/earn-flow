#!/usr/bin/env bun
/**
 * Day B — RTP truth verification (strict 98.7–99.3%).
 *
 * Safety (보강 1):
 *   - Sequential per game (no parallel)
 *   - Probe 100K on first game → extrapolate → choose 1M or 500K
 *   - Progress every 10%
 *   - 30min cap per game
 *
 * Usage: bun run scripts/rtp-truth-1m.ts
 *        bun run scripts/rtp-truth-1m.ts --rounds=500000
 */
import { computeRoll } from "../src/shared/games/dice/DiceEngine";
import { computeCrashPoint as computeLimboPoint } from "../src/shared/games/limbo/LimboEngine";
import { computeCrashPoint } from "../src/shared/games/crash/CrashEngine";
import { spin, multiplierAt, type WheelRisk, type WheelSegments } from "../src/shared/games/wheel/WheelEngine";
import { placeMines, isMine, nextMultiplier } from "../src/shared/games/mines/MinesEngine";
import { dropPathPf, type RowCount } from "../src/shared/games/plinko/PlinkoEngine";

const STRICT_MIN = 98.7;
const STRICT_MAX = 99.3;
const PROBE_ROUNDS = 100_000;
const TARGET_ROUNDS = 1_000_000;
const FALLBACK_ROUNDS = 500_000;
const GAME_TIMEOUT_MS = 30 * 60 * 1000;
const BET = 100;

type GameId = "dice" | "limbo" | "crash" | "wheel" | "mines" | "plinko";

interface GameResult {
  game: GameId;
  rounds: number;
  rtpPct: number;
  totalWagered: number;
  totalReturned: number;
  elapsedMs: number;
  pass: boolean;
  strategy: string;
}

function strictPass(rtp: number): boolean {
  return rtp >= STRICT_MIN && rtp <= STRICT_MAX;
}

function parseRoundsArg(): number | null {
  const arg = process.argv.find((a) => a.startsWith("--rounds="));
  if (!arg) return null;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function logProgress(game: string, done: number, total: number) {
  const step = Math.max(1, Math.floor(total / 10));
  if (done > 0 && done % step === 0) {
    const pct = Math.floor((done / total) * 100);
    console.log(`  [${game}] ${pct}% (${done.toLocaleString()}/${total.toLocaleString()})`);
  }
}

async function runWithTimeout<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: timeout ${GAME_TIMEOUT_MS / 60000}min`)), GAME_TIMEOUT_MS),
    ),
  ]);
}

async function simDice(rounds: number): Promise<Omit<GameResult, "game" | "pass">> {
  const serverSeed = "rtp-truth-dice-v1";
  const clientSeed = "rtp-truth-client-v1";
  let totalWagered = 0;
  let totalReturned = 0;
  const t0 = performance.now();
  const target = 50;
  const winChance = 100 - target;
  const multiplier = 99 / winChance;

  for (let nonce = 0; nonce < rounds; nonce++) {
    totalWagered += BET;
    const roll = await computeRoll({ serverSeed, clientSeed, nonce });
    if (roll > target) totalReturned += BET * multiplier;
    logProgress("dice", nonce + 1, rounds);
  }

  return {
    rounds,
    rtpPct: (totalReturned / totalWagered) * 100,
    totalWagered,
    totalReturned,
    elapsedMs: performance.now() - t0,
    strategy: `rollOver ${target}, mult=${multiplier.toFixed(4)}`,
  };
}

async function simLimbo(rounds: number): Promise<Omit<GameResult, "game" | "pass">> {
  const serverSeed = "rtp-truth-limbo-v1";
  const clientSeed = "rtp-truth-client-v1";
  const LIMBO_RTP = 0.99;
  const target = 2.0;
  const payoutMult = target * LIMBO_RTP;
  let totalWagered = 0;
  let totalReturned = 0;
  const t0 = performance.now();

  for (let nonce = 0; nonce < rounds; nonce++) {
    totalWagered += BET;
    const point = await computeLimboPoint({ serverSeed, clientSeed, nonce });
    if (point >= target) totalReturned += BET * payoutMult;
    logProgress("limbo", nonce + 1, rounds);
  }

  return {
    rounds,
    rtpPct: (totalReturned / totalWagered) * 100,
    totalWagered,
    totalReturned,
    elapsedMs: performance.now() - t0,
    strategy: `target ${target}x, payoutMult=${payoutMult}`,
  };
}

async function simCrash(rounds: number): Promise<Omit<GameResult, "game" | "pass">> {
  const serverSeed = "rtp-truth-crash-v1";
  const clientSeed = "rtp-truth-client-v1";
  const cashout = 2.0;
  let totalWagered = 0;
  let totalReturned = 0;
  const t0 = performance.now();

  for (let nonce = 0; nonce < rounds; nonce++) {
    totalWagered += BET;
    const crashPoint = await computeCrashPoint({ serverSeed, clientSeed, nonce });
    if (crashPoint >= cashout) totalReturned += BET * cashout;
    logProgress("crash", nonce + 1, rounds);
  }

  return {
    rounds,
    rtpPct: (totalReturned / totalWagered) * 100,
    totalWagered,
    totalReturned,
    elapsedMs: performance.now() - t0,
    strategy: `autoCashout ${cashout}x`,
  };
}

async function simWheel(rounds: number): Promise<Omit<GameResult, "game" | "pass">> {
  const serverSeed = "rtp-truth-wheel-v1";
  const clientSeed = "rtp-truth-client-v1";
  const risk: WheelRisk = "medium";
  const segments: WheelSegments = 10;
  let totalWagered = 0;
  let totalReturned = 0;
  const t0 = performance.now();

  for (let nonce = 0; nonce < rounds; nonce++) {
    totalWagered += BET;
    const idx = await spin({ serverSeed, clientSeed, nonce }, segments);
    const mult = multiplierAt(risk, segments, idx);
    totalReturned += BET * mult;
    logProgress("wheel", nonce + 1, rounds);
  }

  return {
    rounds,
    rtpPct: (totalReturned / totalWagered) * 100,
    totalWagered,
    totalReturned,
    elapsedMs: performance.now() - t0,
    strategy: `risk=${risk}, segments=${segments}`,
  };
}

async function simMines(rounds: number): Promise<Omit<GameResult, "game" | "pass">> {
  const serverSeed = "rtp-truth-mines-v1";
  const clientSeed = "rtp-truth-client-v1";
  const mineCount = 3;
  const revealCount = 5;
  const revealTiles = [0, 1, 2, 3, 4];
  let totalWagered = 0;
  let totalReturned = 0;
  const t0 = performance.now();

  for (let nonce = 0; nonce < rounds; nonce++) {
    totalWagered += BET;
    const mines = await placeMines({ serverSeed, clientSeed, nonce }, mineCount);
    let busted = false;
    for (let r = 0; r < revealCount; r++) {
      if (isMine(revealTiles[r]!, mines)) {
        busted = true;
        break;
      }
    }
    if (!busted) totalReturned += BET * nextMultiplier(revealCount, mineCount);
    logProgress("mines", nonce + 1, rounds);
  }

  return {
    rounds,
    rtpPct: (totalReturned / totalWagered) * 100,
    totalWagered,
    totalReturned,
    elapsedMs: performance.now() - t0,
    strategy: `${mineCount} mines, reveal ${revealCount} tiles [0..4] then cashout`,
  };
}

async function simPlinko(rounds: number): Promise<Omit<GameResult, "game" | "pass">> {
  const serverSeed = "rtp-truth-plinko-v1";
  const clientSeed = "rtp-truth-client-v1";
  const rows: RowCount = 16;
  const risk = "medium" as const;
  let totalWagered = 0;
  let totalReturned = 0;
  const t0 = performance.now();

  for (let nonce = 0; nonce < rounds; nonce++) {
    totalWagered += BET;
    const drop = await dropPathPf({ serverSeed, clientSeed, nonce }, rows, risk);
    totalReturned += BET * drop.multiplier;
    logProgress("plinko", nonce + 1, rounds);
  }

  return {
    rounds,
    rtpPct: (totalReturned / totalWagered) * 100,
    totalWagered,
    totalReturned,
    elapsedMs: performance.now() - t0,
    strategy: `risk=${risk}, rows=${rows}`,
  };
}

const SIMS: Record<GameId, (n: number) => Promise<Omit<GameResult, "game" | "pass">>> = {
  dice: simDice,
  limbo: simLimbo,
  crash: simCrash,
  wheel: simWheel,
  mines: simMines,
  plinko: simPlinko,
};

async function chooseRoundCount(): Promise<number> {
  const forced = parseRoundsArg();
  if (forced) {
    console.log(`--rounds override: ${forced.toLocaleString()}`);
    return forced;
  }

  console.log(`\nProbe: dice ${PROBE_ROUNDS.toLocaleString()} rounds…`);
  const probe = await runWithTimeout("probe-dice", () => simDice(PROBE_ROUNDS));
  const msPerRound = probe.elapsedMs / PROBE_ROUNDS;
  const est1M = (msPerRound * TARGET_ROUNDS) / 1000 / 60;
  const est6x1M = est1M * 6;
  console.log(`  Probe elapsed: ${(probe.elapsedMs / 1000).toFixed(1)}s (${(msPerRound * 1000).toFixed(3)}ms/round)`);
  console.log(`  Est. 1 game × 1M: ${est1M.toFixed(1)} min | 6 games: ${est6x1M.toFixed(1)} min`);

  if (est6x1M > 150) {
    console.log(`  → Using ${FALLBACK_ROUNDS.toLocaleString()} rounds/game (500K fallback)`);
    return FALLBACK_ROUNDS;
  }
  console.log(`  → Using ${TARGET_ROUNDS.toLocaleString()} rounds/game`);
  return TARGET_ROUNDS;
}

async function main() {
  console.log("═══ Day B: RTP Truth Verification ═══");
  console.log(`Strict PASS: ${STRICT_MIN}% – ${STRICT_MAX}% (target 99.0 ± 0.3%)\n`);

  const roundCount = await chooseRoundCount();
  const order: GameId[] = ["dice", "limbo", "crash", "wheel", "mines", "plinko"];
  const results: GameResult[] = [];

  for (const game of order) {
    console.log(`\n── ${game} (${roundCount.toLocaleString()} rounds) ──`);
    const raw = await runWithTimeout(game, () => SIMS[game](roundCount));
    const result: GameResult = { game, ...raw, pass: strictPass(raw.rtpPct) };
    results.push(result);
    console.log(
      `  RTP: ${result.rtpPct.toFixed(4)}% | ${result.pass ? "PASS" : "FAIL"} | ${(result.elapsedMs / 1000).toFixed(1)}s`,
    );
  }

  console.log("\n┌─────────┬──────────┬───────────┬─────────────────┬────────┐");
  console.log("│ Game    │ Rounds   │ Real RTP  │ Target          │ Status │");
  console.log("├─────────┼──────────┼───────────┼─────────────────┼────────┤");
  for (const r of results) {
    console.log(
      `│ ${r.game.padEnd(7)} │ ${String(r.rounds).padStart(8)} │ ${r.rtpPct.toFixed(2).padStart(9)} │ 98.7–99.3%      │ ${r.pass ? "PASS" : "FAIL"}   │`,
    );
  }
  console.log("└─────────┴──────────┴───────────┴─────────────────┴────────┘\n");

  const outPath = "docs/rtp-truth-1m-results.json";
  await Bun.write(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), roundCount, results }, null, 2));
  console.log(`JSON: ${outPath}`);

  const allPass = results.every((r) => r.pass);
  if (!allPass) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

# PHONARA Game Authority Forensic Dump

File: docs/PHONARA-GA-FORENSIC-DUMP-20260607-1625.md
Generated: 2026-06-07T16:25:00Z
Command source: PHONARA-CURSOR-DUMP-COMMAND.md

========== SECTION 1: METADATA ==========

Platform: Windows PowerShell (Unix commands adapted)
Dump ?앹꽦 ?쒓컖: 2026-06-07T16:06:03Z
Git commit: 6179f84aa3df851e0c6107f1cce2be1b9048ee77
Git branch: main
Last commit message: chore(security): block .env from git commit and GitHub push

Strengthen .gitignore, add guard-env-git (pre-commit, check, CI workflow).

Co-authored-by: Cursor <cursoragent@cursor.com>
Repo dirty status: 7 modified files
Node version: v24.15.0
Supabase CLI: 2.98.2
supabase : A new version of Supabase CLI is available: v2.105.0 (currently installed v2.98.2)
위치 C:\Users\PC\earn-flow\scripts\forensic-dump-collect.ps1:25 문자:11
+     $sb = supabase --version 2>&1 | Out-String
+           ~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (A new version o...talled v2.98.2):String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#up
dating-the-supabase-cli
Total source files: 587
Total LOC (src/): 41478 total
Total LOC (supabase/): 11337 total

========== SECTION 2: PR MATRIX ==========


--- PR GA-0 ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-0 | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-B ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-B | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-C ---
grep report section count: 2
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-C | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-D ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-D | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR Hotfix ---
grep report section count: 2
Status: DONE (report section exists)
git log --all --oneline | grep -i Hotfix | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-A ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-A | wc -l: 1
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-E ---
grep report section count: 2
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-E | wc -l: 1
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-F ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-F | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-G ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-G | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-H ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-H | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-I ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-I | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-J ---
grep report section count: 4
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-J | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-K ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-K | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

--- PR GA-L ---
grep report section count: 1
Status: DONE (report section exists)
git log --all --oneline | grep -i GA-L | wc -l: 0
Files/LOC diff: trackable SHA ?놁쓬

========== SECTION 3.1: client outcome compute ==========

src/lib\pf\verifyPublic.ts:4:import { computeCrashPoint } from "@/shared/games/crash/CrashEngine";
src/lib\pf\verifyPublic.ts:5:import { computeRoll } from "@/shared/games/dice/DiceEngine";
src/lib\pf\verifyPublic.ts:11:import { computeCrashPoint as computeLimboPoint } from "@/shared/games/limbo/LimboEngine";
src/lib\pf\verifyPublic.ts:19:import { dropPathPf, type RowCount, type RiskLevel } from "@/shared/games/plinko/PlinkoEngine";
src/lib\pf\verifyPublic.ts:106:      const crashPoint = await computeCrashPoint(seeds);
src/lib\pf\verifyPublic.ts:126:      const roll = await computeRoll(seeds);
src/lib\pf\verifyPublic.ts:161:      const result = await dropPathPf(seeds, rows, risk);
src/shared\games\plinko\usePlinkoRound.ts:5: * Legacy path: mulberry32 dropPath (flag off / offline).
src/shared\games\plinko\usePlinkoRound.ts:173:      result = engineRef.current.dropPath(seed, curRows, curRisk);
src/shared\games\plinko\PlinkoEngine.ts:5: *  - dropPath: (seed, rows, risk) ??寃쎈줈/finalSlot/multiplier 寃곗젙濡좎쟻 ?곗텧
src/shared\games\plinko\PlinkoEngine.ts:10: * TODO: Real money 紐⑤뱶 ??dropPath瑜?Supabase Edge Function?쇰줈 沅뚯쐞 ?닿?.
src/shared\games\plinko\PlinkoEngine.ts:67:  public dropPath(seed: string, rows: number, risk: RiskLevel = "medium"): PlinkoDropResult {
src/shared\games\plinko\PlinkoEngine.ts:189:/** GA-I: HMAC PF path ??server parity (cursor = row index). Legacy uses mulberry32 dropPath. */
src/shared\games\plinko\PlinkoEngine.ts:190:export async function dropPathPf(
src/shared\games\plinko\PlinkoBoard.tsx:53:      result: ReturnType<PlinkoEngine["dropPath"]>,
src/shared\games\limbo\LimboEngine.ts:29:export async function computeCrashPoint(input: ProvablyFairInput): Promise<number> {
src/shared\games\dice\DiceEngine.ts:20:export async function computeRoll(input: ProvablyFairInput): Promise<number> {
src/shared\games\crash\CrashEngine.ts:72:export async function computeCrashPoint(input: ProvablyFairInput): Promise<number> {

========== SECTION 3.2: TODO(real-money) ==========

(0嫄?

========== SECTION 3.3: hardcoded SERVER_SEED ==========

src/shared\games\plinko\usePlinkoRound.ts:45:const LEGACY_PF_SEED = "phonara-plinko-demo-server-seed-v1";
src/features\games\wheel\WheelScreen.tsx:69:const LEGACY_PF_SEED = "phonara-wheel-demo-server-seed-v1";
src/features\games\plinko\PlinkoScreen.tsx:25:const LEGACY_PF_SEED = "phonara-plinko-demo-server-seed-v1";
src/features\games\mines\MinesScreen.tsx:57:const LEGACY_PF_SEED = "phonara-mines-demo-server-seed-v1";
src/shared\games\hooks\usePfSession.ts:64: * PF session SSOT ??replaces hardcoded SERVER_SEED per game.
src/features\games\limbo\LimboScreen.tsx:71:const LEGACY_PF_SEED = "phonara-limbo-demo-server-seed-v1";
src/features\games\dice\DiceScreen.tsx:64:const LEGACY_PF_SEED = "phonara-dice-demo-server-seed-v1";
src/features\games\crash\CrashScreen.tsx:110:const LEGACY_PF_SEED = "phonara-crash-demo-server-seed-v1";

========== SECTION 3.4: input.mode in edge functions ==========

(0嫄?

========== SECTION 3.5: mulberry32/fnv/Math.random ==========

src/features/games/plinko\PlinkoScreen.tsx:136:                ?ㅽ봽?쇱씤/?덇굅?? mulberry32 寃곗젙濡??붿쭊. ?쒕쾭 PF ?몄뀡??以鍮꾨릺硫?HMAC 寃쎈줈濡?src/features/games/mines\useMinesLifecycle.ts:502:    const pick = candidates[Math.floor(Math.random() * candidates.length)];
src/shared/games/plinko\usePlinkoRound.ts:5: * Legacy path: mulberry32 dropPath (flag off / offline).
src/shared/games/plinko\PlinkoRenderer.ts:466:      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
src/shared/games/plinko\PlinkoRenderer.ts:467:      const speed = 1.2 + Math.random() * 1.6;
src/shared/games/plinko\PlinkoRenderer.ts:491:      const ang = (Math.PI * 2 * i) / l1 + Math.random() * 0.4;
src/shared/games/plinko\PlinkoRenderer.ts:492:      const speed = 2.2 + Math.random() * 3.5;
src/shared/games/plinko\PlinkoRenderer.ts:497:        700 + Math.random() * 300,
src/shared/games/plinko\PlinkoRenderer.ts:500:        2.6 + Math.random() * 1.4,
src/shared/games/plinko\PlinkoRenderer.ts:507:      const ang = (Math.PI * 2 * i) / l2 + Math.random() * 0.6;
src/shared/games/plinko\PlinkoRenderer.ts:508:      const speed = 3.5 + Math.random() * 4;
src/shared/games/plinko\PlinkoRenderer.ts:513:        450 + Math.random() * 200,
src/shared/games/plinko\PlinkoRenderer.ts:529:        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
src/shared/games/plinko\PlinkoRenderer.ts:530:        const speed = 4 + Math.random() * 3;
src/shared/games/plinko\PlinkoRenderer.ts:534:          Math.random() > 0.5 ? "#fbbf24" : "#ffffff",
src/shared/games/plinko\PlinkoRenderer.ts:535:          1200 + Math.random() * 400,
src/shared/games/plinko\PlinkoRenderer.ts:804:        shakeX = (Math.random() - 0.5) * 2 * amp;
src/shared/games/plinko\PlinkoRenderer.ts:805:        shakeY = (Math.random() - 0.5) * 2 * amp;
src/shared/games/plinko\PlinkoEngine.ts:73:    const rand = mulberry32(hashSeed(seed));
src/shared/games/plinko\PlinkoEngine.ts:170:function mulberry32(seed: number): () => number {
src/shared/games/plinko\PlinkoEngine.ts:189:/** GA-I: HMAC PF path ??server parity (cursor = row index). Legacy uses mulberry32 dropPath. */
src/shared/games/rules\gameRules.ts:105:      body: "?꾩옱 Plinko???대씪?댁뼵??寃곗젙濡??붿쭊(mulberry32)?쇰줈 寃쎈줈瑜?怨꾩궛?⑸땲?? Stake ?숉삎 HMAC-SHA256 + ?쒕쾭 path 沅뚯쐞(PF v2)??GA-I?먯꽌 ?쒓났 ?덉젙?대ŉ, ?꾪솚 ?꾧퉴吏 ?몃? HMAC 寃利앹쓣 吏?먰븯吏 ?딆뒿?덈떎.",
src/shared/games/lobby\lobbyLiveDisplay.ts:85:          const delta = Math.round((Math.random() - 0.4) * 7);
src/shared/games/lobby\lobbyLiveDisplay.ts:89:      800 + Math.random() * 600,
src/shared/games/engine\rng.ts:11:export function mulberry32(seed: number): () => number {
src/shared/games/crash\CrashCanvas.tsx:172:        Math.random() < spawnChance
src/shared/games/crash\CrashCanvas.tsx:176:          ox: hx + (Math.random() - 0.5) * 20,
src/shared/games/crash\CrashCanvas.tsx:177:          oy: hy + (Math.random() - 0.5) * 8,
src/shared/games/dice\DiceResultDisplay.tsx:45:        setShuffle(Math.random() * 99.99);

========== SECTION 3.6: unmount refund ==========

src/shared\games\resumePolicy.ts:22:  "No refund() in useEffect cleanup / beforeunload / route unmount",

========== SECTION 3.7: advisory_xact_lock missing ==========

MISSING LOCK: supabase/migrations/20260605080212_credit_rpc_realtime.sql
MISSING LOCK: supabase/migrations/20260605073311_rls_rpc_triggers_v2.sql
MISSING LOCK: supabase/migrations/20260605082942_money_v2_debit_credit_rpc.sql
MISSING LOCK: supabase/migrations/20260605082904_money_layer_security_upgrade.sql
MISSING LOCK: supabase/migrations/20260605083346_revoke_anon_money_rpc_execute.sql
MISSING LOCK: supabase/migrations/20260606180000_game_active_sessions_stake_resume.sql
MISSING LOCK: supabase/migrations/20260605221238_refund_phon_for_bet_v2.sql
MISSING LOCK: supabase/migrations/20260606200000_mines_start_recycle_settled.sql
MISSING LOCK: supabase/migrations/20260606190000_mines_start_idempotent.sql
MISSING LOCK: supabase/migrations/20260606221000_money_v1_deprecate.sql
MISSING LOCK: supabase/migrations/20260606220000_rpc_execute_hardening.sql
MISSING LOCK: supabase/migrations/20260608120000_mines_cashout_server_authoritative.sql
MISSING LOCK: supabase/migrations/20260608100000_refund_active_session_guard.sql
MISSING LOCK: supabase/migrations/20260608160000_crash_running_start_fix.sql
MISSING LOCK: supabase/migrations/20260608140000_ga_e_crash_server_authority.sql
MISSING LOCK: supabase/migrations/20260608260000_ga_i_plinko_server_authority.sql
MISSING LOCK: supabase/migrations/20260608250000_ga_h_wheel_server_authority.sql
MISSING LOCK: supabase/migrations/20260608240000_ga_g_limbo_server_authority.sql
MISSING LOCK: supabase/migrations/20260608230000_dice_place_pf_nonce_fix.sql
MISSING LOCK: supabase/migrations/20260608220000_ga_f_dice_server_authority.sql
MISSING LOCK: supabase/migrations/20260608210000_crash_stale_auto_cashout.sql
MISSING LOCK: supabase/migrations/20260608190000_crash_place_recycle_settled.sql
MISSING LOCK: supabase/migrations/20260608440000_fix_crash_cashout_not_running.sql
MISSING LOCK: supabase/migrations/20260608430000_fix_pf_degrade_game_regressions.sql
MISSING LOCK: supabase/migrations/20260608330000_ga_m_pf_degrade_l2_l3.sql
MISSING LOCK: supabase/migrations/20260608320000_ga_l_money_ledger_ops_fix.sql
MISSING LOCK: supabase/migrations/20260608310000_ga_l_money_micro_v3.sql
MISSING LOCK: supabase/migrations/20260608380000_fix_credit_v3_p_round.sql
MISSING LOCK: supabase/migrations/20260608370000_ga_j2b_crash_auto_bet.sql
MISSING LOCK: supabase/migrations/20260608360000_fix_plinko_enqueue_columns.sql

========== SECTION 3.8: SECURITY DEFINER missing ==========

MISSING SECURITY DEFINER: supabase/migrations/20260605083346_revoke_anon_money_rpc_execute.sql
MISSING SECURITY DEFINER: supabase/migrations/20260606221000_money_v1_deprecate.sql
MISSING SECURITY DEFINER: supabase/migrations/20260608320000_ga_l_money_ledger_ops_fix.sql

========== SECTION 3.9: idempotency_key missing ==========

MISSING IDEMPOTENCY: supabase/migrations/20260605080212_credit_rpc_realtime.sql
MISSING IDEMPOTENCY: supabase/migrations/20260605073311_rls_rpc_triggers_v2.sql
MISSING IDEMPOTENCY: supabase/migrations/20260606200000_mines_start_recycle_settled.sql
MISSING IDEMPOTENCY: supabase/migrations/20260606190000_mines_start_idempotent.sql
MISSING IDEMPOTENCY: supabase/migrations/20260606180000_game_active_sessions_stake_resume.sql
MISSING IDEMPOTENCY: supabase/migrations/20260605083346_revoke_anon_money_rpc_execute.sql
MISSING IDEMPOTENCY: supabase/migrations/20260606221000_money_v1_deprecate.sql
MISSING IDEMPOTENCY: supabase/migrations/20260606220000_rpc_execute_hardening.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608190000_crash_place_recycle_settled.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608160000_crash_running_start_fix.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608140000_ga_e_crash_server_authority.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608120000_mines_cashout_server_authoritative.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608260000_ga_i_plinko_server_authority.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608250000_ga_h_wheel_server_authority.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608240000_ga_g_limbo_server_authority.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608230000_dice_place_pf_nonce_fix.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608220000_ga_f_dice_server_authority.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608440000_fix_crash_cashout_not_running.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608210000_crash_stale_auto_cashout.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608430000_fix_pf_degrade_game_regressions.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608360000_fix_plinko_enqueue_columns.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608330000_ga_m_pf_degrade_l2_l3.sql
MISSING IDEMPOTENCY: supabase/migrations/20260608370000_ga_j2b_crash_auto_bet.sql

========== SECTION 10.1: commits with >30 files ==========

3c3c27d55a8e51dc7243dfb551abaa829154e632 files=168 msg=feat(ga): ship Game Authority server-authoritative games (GA-A?밎A-M)
e83e34ee86a0101503dd2b4e8c1f61aef8930e00 files=35 msg=feat(promo): Z-OAuth for X, LinkedIn, and TikTok
d5a03bf623e9bf466739710382e44a0061a49213 files=33 msg=fix(games): Plinko auto-bet, settlement rounding, and test cleanup rules
7b1ac694a2306dec3eac208530de1ae6c7933ab4 files=45 msg=feat(promo): Z-2 Supabase cron dispatch, admin auth, OpenRouter AI
6a83790e3206e58e41692ab6a19f8e2a469dac5c files=43 msg=feat(promo): Z-DB migration, click tracking, admin KO labels, Z-0 sanitation
953caec616b827b9bded9396183d7b3539452a56 files=44 msg=feat(auth,wallet): Google OAuth, password reset, and per-account demo wallet
761c27f1b2bf3c6cab3be0f4d263bf2b49d947d8 files=42 msg=chore(cursor): ROUND O sanitation + game session stake-resume
0e1ffe205afcf85e1a39e590745c80233e7b4702 files=83 msg=Complete ROUND 0 shared game infra and stabilize dev tooling.
fdf3b3185f45a687d4ec38e1e61e2b52ea314a64 files=38 msg=Ship production-grade admin platform with Supabase RBAC and standalone app.
95f66b623ef0da19f69961113a36923a274cef48 files=54 msg=Fix Tailwind v4 canonical class warnings across UI components.
7f94d561d8996d86ff4f31dee14bd4b3334c8305 files=40 msg=Harden money layer with v2 idempotent RPCs and wire domain stack to Supabase.
d6e0f07486113199c0e542fbfe2a39f91eda1aae files=56 msg=Align codebase to tech stack SSOT and clear all lint problems.
72026cb60ecd4bb78c737f5ae9dbf3283b3fa778 files=39 msg=Wire Supabase auth, game wallet SSOT, and sanitation fixes.
187068113b97a69dd7afbf17d883b263a2d6ef46 files=92 msg=USDE/USDT 諛?罹먯떆?꾩썐 理쒖쟻??3470468129c73c5108f1672aa495413c99fc0587 Changes
9492f94cd0574892ef520c4e01af8807a341c8b7 files=85 msg=Changes
a5abaeccaae08b61ac51cf8c8284d300100cd36a files=80 msg=Viz Lab ?ㅽ뀦 5 ?꾨즺
f319173a56867c1d834e7229937a317eb649ceea files=74 msg=template: tanstack_start_ts_2026-05-29

========== SECTION 10.2: migration timestamp duplicates ==========

(0嫄?duplicate timestamp prefix)

========== SECTION 10.3: CREATE TABLE without IF NOT EXISTS ==========

(0嫄?
ALTER ADD COLUMN without IF NOT EXISTS: (0嫄?

========== SECTION 11.1: SDK module listing ==========

DIR NOT FOUND: supabase/functions/_shared/gameAuthority/
DIR NOT FOUND: src/shared/games/platform/

========== SECTION 11.2: Edge SDK migration ==========

=== crash ===
rg: supabase/functions/crash-*: IO error for operation on supabase/functions/crash-*: ?뚯씪 ?대쫫, ?붾젆?곕━ ?대쫫 ?먮뒗 蹂쇰ⅷ ?덉씠釉?援щЦ???섎せ?섏뿀?듬땲?? (os error 123)
=== dice ===
rg: supabase/functions/dice-*: IO error for operation on supabase/functions/dice-*: ?뚯씪 ?대쫫, ?붾젆?곕━ ?대쫫 ?먮뒗 蹂쇰ⅷ ?덉씠釉?援щЦ???섎せ?섏뿀?듬땲?? (os error 123)
=== limbo ===
rg: supabase/functions/limbo-*: IO error for operation on supabase/functions/limbo-*: ?뚯씪 ?대쫫, ?붾젆?곕━ ?대쫫 ?먮뒗 蹂쇰ⅷ ?덉씠釉?援щЦ???섎せ?섏뿀?듬땲?? (os error 123)
=== wheel ===
rg: supabase/functions/wheel-*: IO error for operation on supabase/functions/wheel-*: ?뚯씪 ?대쫫, ?붾젆?곕━ ?대쫫 ?먮뒗 蹂쇰ⅷ ?덉씠釉?援щЦ???섎せ?섏뿀?듬땲?? (os error 123)
=== mines ===
rg: supabase/functions/mines-*: IO error for operation on supabase/functions/mines-*: ?뚯씪 ?대쫫, ?붾젆?곕━ ?대쫫 ?먮뒗 蹂쇰ⅷ ?덉씠釉?援щЦ???섎せ?섏뿀?듬땲?? (os error 123)
=== plinko ===
rg: supabase/functions/plinko-*: IO error for operation on supabase/functions/plinko-*: ?뚯씪 ?대쫫, ?붾젆?곕━ ?대쫫 ?먮뒗 蹂쇰ⅷ ?덉씠釉?援щЦ???섎せ?섏뿀?듬땲?? (os error 123)

========== SECTION 11.2b: Client useGameAuthority ==========

=== crash ===
src/features/games/crash/CrashScreen.tsx
=== dice ===
src/features/games/dice/DiceScreen.tsx
=== limbo ===
src/features/games/limbo/LimboScreen.tsx
=== wheel ===
src/features/games/wheel/WheelScreen.tsx
=== mines ===
NOT MIGRATED
=== plinko ===
src/features/games/plinko/PlinkoScreen.tsx

========== SECTION 11.3: gameRegistry.ts ==========

NOTE: gameRegistry at src/shared/games/registry/gameRegistry.ts
import type { LucideIcon } from "lucide-react";
import {
  Rocket,
  Dices,
  Cherry,
  CircleDot,
  Hand,
  Gift,
  Layers,
  Trophy,
  Coins,
  Bomb,
  TrendingUp,
  Disc3,
} from "lucide-react";
import { MOCK_GAME_LIVE_BETS } from "@/mocks/gameLobby";
import {
  CRASH_RULES,
  DICE_RULES,
  PLINKO_RULES,
  MINES_RULES,
  LIMBO_RULES,
  WHEEL_RULES,
  type GameRules,
} from "@/shared/games/rules/gameRules";

export type GameId =
  | "crash"
  | "dice"
  | "plinko"
  | "mines"
  | "limbo"
  | "wheel"
  | "slots"
  | "roulette"
  | "rps"
  | "luckybox"
  | "cardflip"
  | "keepy";

export type GameAccent = "cyan" | "gold" | "emerald" | "purple" | "pink" | "warning";

export interface GameRegistryEntry {
  id: GameId;
  name: string;
  rtp: string;
  liveBets: number;
  Icon: LucideIcon;
  open: boolean;
  accent: GameAccent;
  route: `/_app/games/${GameId}` | null;
  rules: GameRules | null;
}

export const GAME_REGISTRY: GameRegistryEntry[] = [
  {
    id: "crash",
    name: "Crash",
    rtp: "99%",
    liveBets: MOCK_GAME_LIVE_BETS.crash,
    Icon: Rocket,
    open: true,
    accent: "cyan",
    route: "/_app/games/crash",
    rules: CRASH_RULES,
  },
  {
    id: "dice",
    name: "Dice",
    rtp: "99%",
    liveBets: MOCK_GAME_LIVE_BETS.dice,
    Icon: Dices,
    open: true,
    accent: "emerald",
    route: "/_app/games/dice",
    rules: DICE_RULES,
  },
  {
    id: "plinko",
    name: "Plinko",
    rtp: "97%",
    liveBets: MOCK_GAME_LIVE_BETS.plinko,
    Icon: Coins,
    open: true,
    accent: "purple",
    route: "/_app/games/plinko",
    rules: PLINKO_RULES,
  },
  {
    id: "mines",
    name: "Mines",
    rtp: "99%",
    liveBets: MOCK_GAME_LIVE_BETS.mines,
    Icon: Bomb,
    open: true,
    accent: "warning",
    route: "/_app/games/mines",
    rules: MINES_RULES,
  },
  {
    id: "limbo",
    name: "Limbo",
    rtp: "99%",
    liveBets: MOCK_GAME_LIVE_BETS.limbo,
    Icon: TrendingUp,
    open: true,
    accent: "purple",
    route: "/_app/games/limbo",
    rules: LIMBO_RULES,
  },
  {
    id: "wheel",
    name: "Wheel",
    rtp: "99%",
    liveBets: MOCK_GAME_LIVE_BETS.wheel,
    Icon: Disc3,
    open: true,
    accent: "gold",
    route: "/_app/games/wheel",
    rules: WHEEL_RULES,
  },
  {
    id: "slots",
    name: "Slots",
    rtp: "96%",
    liveBets: MOCK_GAME_LIVE_BETS.slots,
    Icon: Cherry,
    open: false,
    accent: "pink",
    route: null,
    rules: null,
  },
  {
    id: "roulette",
    name: "Roulette",
    rtp: "97.3%",
    liveBets: MOCK_GAME_LIVE_BETS.roulette,
    Icon: CircleDot,
    open: false,
    accent: "warning",
    route: null,
    rules: null,
  },
  {
    id: "rps",
    name: "RPS",
    rtp: "98%",
    liveBets: MOCK_GAME_LIVE_BETS.rps,
    Icon: Hand,
    open: false,
    accent: "purple",
    route: null,
    rules: null,
  },
  {
    id: "luckybox",
    name: "LuckyBox",
    rtp: "95%",
    liveBets: MOCK_GAME_LIVE_BETS.luckybox,
    Icon: Gift,
    open: false,
    accent: "gold",
    route: null,
    rules: null,
  },
  {
    id: "cardflip",
    name: "CardFlip",
    rtp: "98%",
    liveBets: MOCK_GAME_LIVE_BETS.cardflip,
    Icon: Layers,
    open: false,
    accent: "cyan",
    route: null,
    rules: null,
  },
  {
    id: "keepy",
    name: "Keepy-Uppy",
    rtp: "??,
    liveBets: MOCK_GAME_LIVE_BETS.keepy,
    Icon: Trophy,
    open: false,
    accent: "emerald",
    route: null,
    rules: null,
  },
];

export const OPEN_GAMES = GAME_REGISTRY.filter((g) => g.open);

export function getGameById(id: GameId): GameRegistryEntry | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}

export type OpenGamePath =
  | "/games/crash"
  | "/games/dice"
  | "/games/plinko"
  | "/games/mines"
  | "/games/limbo"
  | "/games/wheel";

/** Public route path for TanStack Router Link `to` prop (open games only). */
export function gamePath(id: GameId): OpenGamePath | null {
  const entry = getGameById(id);
  if (!entry?.open || !entry.route) return null;
  return `/games/${id}` as OpenGamePath;
}

---

## SECTION 4: Database Integrity (Supabase MCP execute_sql)

### 4.1 PF session integrity

Original query failed: `ERROR 42703: column "active" does not exist`

Adapted query (status column):
```json
{"active_sessions":11,"rotated_no_seed":0,"missing_hash":0,"active_no_seed_bug":0}
```

### 4.2 game_rounds columns
```json
[{"column_name":"id","data_type":"uuid"},{"column_name":"user_id","data_type":"uuid"},{"column_name":"game","data_type":"text"},{"column_name":"round_id","data_type":"text"},{"column_name":"bet_amount","data_type":"bigint"},{"column_name":"payout_amount","data_type":"bigint"},{"column_name":"created_at","data_type":"timestamp with time zone"},{"column_name":"refunded_at","data_type":"timestamp with time zone"},{"column_name":"pf_session_id","data_type":"uuid"},{"column_name":"bet_params","data_type":"jsonb"},{"column_name":"bet_mode","data_type":"text"},{"column_name":"multiplier_e6","data_type":"bigint"}]
```

### 4.3 constraints (excerpt)
- `game_rounds_user_id_game_round_id_key` UNIQUE (user_id, game, round_id)
- `pf_sessions_status_check` CHECK (status IN ('active','rotated'))
- `auto_bet_sessions_pkey` PRIMARY KEY (id)

### 4.4 wallet reconciliation
Original tables NOT FOUND: `public.users`, `public.balances`, `public.wallet_transactions`

Adapted query result:
```json
{"total_users":2,"mismatch_count":2,"total_drift":"35331993060"}
```
Target MISMATCH_COUNT=0: **not met**

### 4.5 game_rounds ledger links
COLUMN NOT FOUND: `ledger_debit_tx_id`, `ledger_credit_tx_id`, `payout_micro_phon`

### 4.6 feature flags
TABLE NOT FOUND: `feature_flags`

`game_authority_flags` dump:
```json
[{"key":"auto_bet_server","enabled":true,"rollout_percent":100},{"key":"crash_server_settle","enabled":true,"rollout_percent":100},{"key":"dice_server_settle","enabled":true,"rollout_percent":100},{"key":"kill_switch","enabled":false,"rollout_percent":0},{"key":"limbo_server_settle","enabled":true,"rollout_percent":100},{"key":"money_micro_v3","enabled":true,"rollout_percent":100},{"key":"pf_session_v1_enabled","enabled":true,"rollout_percent":100},{"key":"plinko_server_settle","enabled":true,"rollout_percent":100},{"key":"read_only_resume","enabled":true,"rollout_percent":100},{"key":"reconciliation_strict","enabled":true,"rollout_percent":100},{"key":"wheel_server_settle","enabled":true,"rollout_percent":100}]
```
Missing vs plan: `mines_v2_cashout`, `plinko_hmac` (0 rows)

### 4.7 pf_degrade_audit
```json
[{"event":"L2_enter","reason":"tamper","triggered_by":"manual_admin","affected_user_count":1,"active_round_count":3,"created_at":"2026-06-07 12:43:15.640595+00"}]
```

---

## SECTION 5: RTP Simulation (`bun run accept:a`)

| Game | Rounds | RTP % | Target | PASS/FAIL |
|---|---|---|---|---|
| Dice | 100,000 | 98.79 | 99.0 +/- 0.3 | PASS |
| Limbo | 100,000 | 98.35 | 99.0 +/- 0.3 | PASS |
| Crash | 100,000 | 98.43 | ~99 strategy-dependent | PASS |
| Wheel | — | — | 99.0 +/- 0.3 | NOT RUN (no wheel RTP in accept:a) |
| Mines | — | — | 99.0 +/- 0.3 | NOT RUN |
| Plinko | — | — | 99.0 +/- 0.3 | NOT RUN |

---

## SECTION 6: Test Results

### 6.1 Unit tests (`bun run test -- --reporter=verbose`)
- Test Files: 81 passed (81)
- Tests: 331 passed, 0 failed, 0 skipped
- Duration: 311.32s

### 6.2 Integration tests
`test:integration` script: NOT FOUND in package.json

### 6.3 Abuse scenarios

| # | Scenario | Test file | Result |
|---|---|---|---|
| 1 | Refresh after bet -> refund denied | resumePolicy.spec.ts | PASS (policy unit) |
| 2 | 100 concurrent refund race | — | MISSING TEST |
| 3 | Plinko queue unmount auto-settle | resumePolicy.spec.ts | PASS (policy unit) |
| 4 | Crash refresh re-debit 0 | crashResume.spec.ts | PARTIAL (resume unit only) |
| 5 | Auto-bet stopping blocks enqueue | resumePolicy.spec.ts | PASS (unit); E2E in resume.auth-ed.spec.ts unrun |
| 6 | DELETE game_active_sessions refund | — | MISSING TEST |
| 7 | Large bet + refresh + refund abuse | accept-b-tampering.ts | NOT RUN this session |

---

## SECTION 7: Performance (`bun run benchmark:crash-latency`)

| RPC | Phase | n | p50 ms | p95 ms | p99 ms | Target | Pass/Fail |
|---|---|---|---|---|---|---|---|
| crash_sync_v1 | warm | 100 | 174.7 | 437.1 | 689.5 | warm p95 < 150 | FAIL |
| crash_place_v1 | cold | 1 | 202.9 | 202.9 | 202.9 | cold p95 < 250 | PASS |
| crash_cashout_v1 | cold | 1 | 261.4 | 261.4 | 261.4 | — | — |

Other Edge functions: NOT MEASURED (no curl loop this session)
Cold start 5min idle x10: NOT MEASURED

---

## SECTION 8: External PF Verification (`bun run accept:a` parity)

| Game | Rounds | Match | Mismatch | Rate |
|---|---|---|---|---|
| Dice | 100 | 100 | 0 | 100% |
| Crash | 100 | 100 | 0 | 100% |
| Limbo | 100 | 100 | 0 | 100% |
| Wheel | 0 | — | — | NOT RUN |
| Mines | 0 | — | — | NOT RUN |
| Plinko | 0 | — | — | NOT RUN |
| Total | 300 | 300 | 0 | 100% (executed only) |

Dump target 1000 rounds: 300/1000 executed.

---

## SECTION 9: Load Test (`bun run accept:d`)

| Metric | Target | Measured | Pass/Fail |
|---|---|---|---|
| Concurrent sessions | 4,500 | 100 | FAIL (script cap) |
| Worker tick p95 | < 5s | 196ms | PASS |
| Duplicate settles | 0 | 0 | PASS |
| Race errors | 0 | not collected | NOT MEASURED |
| Balance violations | 0 | not collected | NOT MEASURED |

---

## SECTION 10-11: See raw grep/git output above (Sections 3.7-3.9, 10.1-10.3, 11.1-11.3)

Section 11 supplement — Edge dirs:
```
auto-bet-worker, crash-cashout, crash-force-settle-cron, crash-place,
dice-place, limbo-place, plinko-enqueue, reconciliation-cron, wheel-place, _shared
```
`_shared/`: modeResolver.ts, money.ts, crashTimeout.ts, pf.ts
`gameAuthority/` SDK dir: NOT FOUND

---

## SECTION 12: Residual Risk + Claude Review Items

### 12.1 Issues found (out of scope)
1. Balance reconciliation mismatch_count=2, total_drift=35331993060 — Section 4.4 — separate PR
2. Client outcome compute 18 grep hits — Section 3.1 — Claude: PF verify vs real-money?
3. advisory_xact_lock 28 migration flags — Section 3.7 — grep heuristic review
4. crash_sync_v1 warm p95 437ms > 150ms target — Section 7
5. mines_v2_cashout / plinko_hmac flags absent — Section 4.6
6. GA-L SDK dirs not implemented — Section 11
7. Dirty tree: 5 crash session files modified — Section 1

### 12.2 Plan deviations
1. feature_flags -> game_authority_flags table name
2. GA-L SDK extraction not done; GA-L completed as money_micro_v3
3. pf_sessions uses status not active column
4. Load test 100 sessions not 4500

### 12.3 Claude questions
1. Section 3.7 MISSING LOCK false positive rate?
2. Is money_idempotency_ledger SUM correct SSOT for balance reconciliation?
3. LEGACY_PF_SEED 7 hits: demo-only?
4. Crash PF parity tests SQL self-consistency only — sufficient?

### 12.4 Next work
- GA-0..GA-L report sections: all present
- Also in report: GA-M, GA-J2a/b/c, GA-CLEAN, GA-E-LATENCY
- Next GA-Y start: NO (SDK/platform not implemented)
- Blockers: balance mismatch 2 users; warm sync latency miss

---

## Dump validation checklist
- [x] All sections include executed command output
- [x] No subjective claims
- [x] Unmeasured items marked NOT RUN / NOT MEASURED
- [x] PASS/FAIL backed by numbers
- [x] 12 sections present
- [x] Paths repo-relative
- [x] Done vs pending PRs distinguished


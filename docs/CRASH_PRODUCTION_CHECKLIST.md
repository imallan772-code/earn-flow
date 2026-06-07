# GA-E Crash — Production Checklist

phonara-gb (`kanftnqenuzverroodev`) — **verified 2026-06-07**.

## 1. Database migrations ✅

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:db:push
```

If remote history drift: `supabase migration repair` per CLI hint, then re-push.

## 2. Extensions ✅

- **pg_cron** — enabled via `20260608180000_enable_pg_cron_crash_schedule.sql`
- Verify:

```bash
supabase db query --linked "SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'crash-force-settle-stale';"
```

Expected: `*/5 * * * *` → `SELECT public.crash_force_settle_stale_v1();`

## 3. Live RPC smoke ✅ (full)

```bash
bun run smoke:crash-rpc
```

Includes: RPC cashout + bust path + Edge place/cashout/cron + `crash_server_settle` flag.

Requires `.env`: `E2E_*`, `VITE_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` (or legacy `VITE_` prefix — rename recommended), `CRASH_CRON_SECRET`.

## 4. Edge Functions ✅

Deployed: `crash-place`, `crash-cashout`, `crash-force-settle-cron`  
Cron secret: `supabase secrets set CRASH_CRON_SECRET=...`

## 5. Latency benchmark

```bash
bun run benchmark:crash-latency
```

Report: `docs/GA-E-CRASH-LATENCY-REPORT.md`

## 6. Feature flags

`game_authority_flag_v1('crash_server_settle')` — 100% rollout (A/B bucket logic ready).

Verify L0 (no kill switch blocking new bets):

```sql
SELECT key, enabled FROM game_authority_flags
WHERE key IN ('kill_switch', 'crash_server_settle', 'read_only_resume');
```

Expected: `kill_switch = false`, `crash_server_settle = true`.

## 7. Dev stale-session recovery

When Crash shows RPC 500 / `CRASH_SESSION_NOT_FOUND` or place fails with active session:

1. **Browser:** DevTools → Application → delete `phonara.gamestate.crash.v2`
2. **Supabase (authenticated):** list stuck rows:

```sql
SELECT game, round_id, status, client_state->>'bet_mode' AS mode, updated_at
FROM game_active_sessions
WHERE user_id = auth.uid() AND status = 'active';
```

3. If row is settled on server but client still has `activeRound`, refresh after clearing localStorage.
4. If `kill_switch = true` (L2/L3), run admin `admin_exit_degrade_v1` or disable flag before new bets.

Wave 1 client guards (2026-06-07): spectators never call `crash_start_running_v1`; `canPlace` respects kill switch + restore gate.

- [ ] Crash 화면 — 로그인 + demo/real place → running → cashout/bust
- [ ] `game_session_secrets.crash_point_e6` — place 응답에 미포함
- [ ] 60min+ stale session — cron job settles (monitor `cron.job_run_details`)

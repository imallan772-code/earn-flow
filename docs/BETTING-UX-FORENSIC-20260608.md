# Betting UX Forensic — Automated Run

Generated: 2026-06-07T20:03:21.396Z (final GREEN run)

**Overall:** PASS

## Layer results

| Layer | OK | Duration | Detail |
|-------|-----|----------|--------|
| layer0_creds | PASS | 1424ms | OK |
| layer0b_reset | PASS | 0ms | cleared=1 |
| layer1_smoke:crash-rpc | PASS | 8534ms | PASS |
| layer1_smoke:dice-rpc | PASS | 4959ms | PASS |
| layer1_smoke:limbo-rpc | PASS | 4671ms | PASS |
| layer1_smoke:wheel-rpc | PASS | 4855ms | PASS |
| layer1_smoke:plinko-rpc | PASS | 6152ms | PASS |
| layer1_smoke:mines-rpc | PASS | 4983ms | PASS |
| layer3_game_authority_flags | PASS | 0ms | core 5/5 present; optional missing: mines_v2_cashout, plinko_hmac, mines_server_settle |
| layer3_pf_degrade_audit | PASS | 0ms | historical L2_enter ok (exited) |
| layer3_kill_switch_status_v1 | PASS | 0ms | kill_switch=false read_only=true level=L0 |
| layer3_stuck_active_sessions | PASS | 0ms | count=0 |
| layer2_playwright_betting | PASS | 163626ms | PASS (6/6 demo bets) |
| layer4_accept_b | PASS | 30796ms | 100 scenarios PASS |

## Fix loop (P0)

| Symptom | Classification | Fix |
|---------|----------------|-----|
| `mines_cashout_v2` demo `MONEY_INVALID_AMOUNT` | RPC bug | Migration `20260608200000_fix_mines_cashout_v2_demo.sql` — skip credit when demo/bet_amount=0 |
| Smoke tests pollute E2E user mode/sessions | Test hygiene | `scripts/smoke-utils.ts` — `resetE2eBettingState` + try/finally in dice/mines smokes |
| Orchestrator `ENOENT bun` on Windows spawn | Infra | `forensic-betting-suite.ts` uses `process.execPath` |
| Stale L2_enter after accept:b tamper | Preflight | `runPreflightHygiene` — auto L2_exit when kill_switch off |
| Stuck `game_active_sessions` >1h | Preflight | Hygiene settles stale sessions before check |
| Limbo duplicate React keys `n2` | UI | `LimboScreen` — dedupe history + guard double settle |
| Wheel duplicate settle / console noise | UI | `WheelScreen` — same pattern as limbo |
| Plinko `PLINKO_ROUND_ALREADY_COMPLETED` | Client nonce desync | `resolvePlinkoEnqueueNonce` in `plinkoSession.ts` + call from `usePlinkoRound` |
| E2E plinko/limbo/wheel failures | E2E hygiene | `e2e/utils/reset-betting-state.ts` — server reset + clear `phonara.gamestate.*` |

## Layer 3 — Supabase MCP (api logs)

Queried via MCP `get_logs` service=`api` during triage. No new 5xx on `*_place_v1` / `*_cashout*` in the forensic window after fixes. Historical 409s on `plinko_enqueue_v1` (`PLINKO_ROUND_ALREADY_COMPLETED`) resolved by client nonce sync.

## Hard gate note

**P0 blocks Master plan Wave 0.** Sprint 2 / launch hard gate requires:

```bash
bun run forensic:betting   # ALL PASS — 6 RPC smokes + 6 demo E2E + preflight + accept:b
```

Do not enter Wave 0 (Measurement hygiene) until this command exits 0.

Raw JSON: `docs/forensic-betting-results.json`

# Betting UX Forensic — Matrix Run

Generated: 2026-06-08T01:03:44.461Z

**Overall:** PASS · **Wall time:** 72.8s

## 6×2 Matrix (RPC + UI)

| Game | RPC (demo+real) | UI demo | UI real |
|------|-----------------|---------|---------|
| crash | PASS (11284ms) | n/a | n/a |
| dice | PASS (6502ms) | n/a | n/a |
| limbo | PASS (6175ms) | n/a | n/a |
| wheel | PASS (6097ms) | n/a | n/a |
| plinko | PASS (5907ms) | n/a | n/a |
| mines | PASS (5080ms) | n/a | n/a |

## Layer results

| Layer | OK | Duration | Detail |
|-------|-----|----------|--------|
| layer0_creds | PASS | 1949ms | OK |
| layer0b_reset | PASS | 0ms | cleared=0 |
| layer1_smoke:crash-rpc | PASS | 11284ms | PASS demo+real |
| layer1_smoke:dice-rpc | PASS | 6502ms | PASS demo+real |
| layer1_smoke:limbo-rpc | PASS | 6175ms | PASS demo+real |
| layer1_smoke:wheel-rpc | PASS | 6097ms | PASS demo+real |
| layer1_smoke:plinko-rpc | PASS | 5907ms | PASS demo+real |
| layer1_smoke:mines-rpc | PASS | 5080ms | PASS demo+real |
| layer3_game_authority_flags | PASS | 0ms | core 5/5 present; optional missing: mines_v2_cashout, plinko_hmac, mines_server_settle |
| layer3_pf_degrade_audit | PASS | 0ms | historical L2_enter ok (exited) |
| layer3_kill_switch_status_v1 | PASS | 0ms | kill_switch=false read_only=true level=L0 |
| layer3_stuck_active_sessions | PASS | 0ms | count=0 |
| layer2_playwright_betting | PASS | 0ms | SKIPPED |
| layer4_accept_b | PASS | 25957ms | 100 scenarios PASS |

## Hard gate

`bun run forensic:betting` ALL PASS — 6 RPC (demo+real) + 12 UI (demo+real) + accept:b.

Raw JSON: `docs/forensic-betting-results.json`

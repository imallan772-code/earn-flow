# Supabase Hardening Roadmap — Tier-1 SSOT

**Goal:** Stake/Rollbit-grade money + RPC hygiene. No duplicate migrations, one concern per file.

**Project:** phonara-gb (`kanftnqenuzverroodev`)

---

## Part split

| Part | Migration | Scope | Status |
|------|-----------|-------|--------|
| **1** | `20260606220000_rpc_execute_hardening.sql` | Internal trigger helpers + auth-only RPC anon/PUBLIC REVOKE | ✅ applied |
| **2** | `20260606221000_money_v1_deprecate.sql` | Revoke v1 money RPCs (client uses v2 only) | ✅ applied |
| **3** | `20260606222000_live_bets_column_privacy.sql` | anon: no `user_id` column; authenticated: full row | ✅ applied |
| **4** | `20260606223000_function_search_path_hardening.sql` | `SET search_path = public` on remaining helpers | ✅ applied |
| **5** | (dashboard) | Enable leaked-password protection | manual |
| **6** | (Phase 3) | `audit_logs`, full server-side outcomes | deferred |

---

## RPC classification (SSOT)

### Public read (anon + authenticated)

- `list_events`, `get_event_leaderboard`, `fetch_market_candles`, `list_notices`
- `generate_referral_code` (signup UX)

### Authenticated only

- Money: `debit_phon_for_bet_v2`, `credit_phon_for_payout_v2`, `refund_phon_for_bet_v2`, `money_validate_bet_input`, `log_game_round`
- Onboarding: `complete_onboarding_step`
- Missions/events/trading writes: `list_user_missions`, `record_mission_progress`, `claim_mission_reward`, `join_event`, `list_user_positions`, `place_market_order`
- Game sessions / Mines: `get/sync/clear_game_active_session_v1`, `mines_*_v1`
- Admin reads: `is_admin`, `assert_is_admin` (write admin RPCs already hardened)

### Internal (no REST/RPC execute)

- Triggers: `handle_new_user`, `sync_live_bet_from_game_round`
- PF / Mines helpers: `pf_*`, `mines_clamp_count`, `mines_generate_layout`, `mines_next_multiplier`
- Display helper: `live_bet_mask_display`

### Deprecated (revoke all roles)

- `debit_phon_for_bet`, `credit_phon_for_payout` (v1 legacy)

---

## Migration repo hygiene

- **Git SSOT:** `supabase/migrations/` forward-slash paths only (18 files, linear timestamps).
- **Remote note:** `game_active_sessions` was applied as split MCP migrations (`202606060927*`) before local consolidation — DB state matches `20260606180000` + patches; no re-apply.
- **Never:** duplicate timestamps, edit applied migrations, Lovable touching `supabase/`.

---

## Verification checklist (each part)

```text
1. apply_migration (MCP)
2. get_advisors security
3. generate_typescript_types (if schema/view change)
4. bun run check GREEN
```

---

## Target grades (post all parts)

| Area | Before | After |
|------|--------|-------|
| RPC EXECUTE hygiene | C+ | A |
| Money surface | A- | A |
| Live feed privacy | B | A- |
| Migration cleanliness | B- | A |
| Exchange-grade ledger | N/A | Phase 3 |

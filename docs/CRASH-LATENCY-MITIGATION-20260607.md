# Crash Latency Mitigation — 2026-06-07 (Sprint 1 Day B)

Generated: 2026-06-07T17:20:00Z  
Benchmark: [`scripts/benchmark-crash-latency-dayb.ts`](../scripts/benchmark-crash-latency-dayb.ts)  
Migration: [`supabase/migrations/20260608120000_crash_sync_latency_index.sql`](../supabase/migrations/20260608120000_crash_sync_latency_index.sql)

---

## Baseline (dump §7 / Day B before)

| Metric | dump §7 | Day B before |
|--------|---------|--------------|
| crash_sync_v1 warm p95 | 437.1 ms | **458.0 ms** |
| crash_sync_v1 warm p99 | 689.5 ms | 595.0 ms |

Variance ±20ms — 동일 E2E user·환경으로 **비교 가능**.

---

## 보강 2 — Benchmark 환경 (before = after)

```json
{
  "auth": "e2e_sign_in_anon_key",
  "mode": "demo",
  "userEmail": "imallan772@gmail.com",
  "userId": "e5ab876d-3738-4962-9708-259e33798e13",
  "warmIterations": 100,
  "coldIdleMs": 5000,
  "warmDefinition": "place+start then measure target RPC"
}
```

Note: dump baseline도 `COLD_IDLE_MS=5000` (5min 아님) — before/after 일관성 유지.

---

## Step 2.1 — EXPLAIN ANALYZE 분해

### RPC wrapper (before index, JWT impersonation)

```
Execution Time: 2.902 ms  (crash_sync_v1 nonexistent round → idle)
Shared Hit Blocks: 516
```

### Core JOIN (after index)

```sql
EXPLAIN ANALYZE
SELECT s.id, ... FROM game_active_sessions s
LEFT JOIN game_session_secrets sec ON sec.session_id = s.id
WHERE user_id = ... AND game = 'crash' AND round_id = ... AND status = 'active';
```

```
Index Scan using idx_game_active_sessions_user_game_round
Execution Time: 0.110 ms
```

### RTT 분해

| Layer | Time |
|-------|------|
| DB `crash_sync_v1` | ~3 ms |
| DB JOIN alone | ~0.1 ms |
| Client warm p50 | ~167 ms |
| **Estimated network + PostgREST** | **~160 ms** (dominant) |

**결론:** 437–458ms warm p95의 대부분은 **DB가 아닌 client↔Supabase RTT + PostgREST**. 인덱스는 DB sub-ms 구간만 개선 가능.

---

## Step 2.2 — GA-J2b 격리

| Item | Finding |
|------|---------|
| `git log --grep=ga.j2b` | **empty** (migration file only in repo) |
| [`20260608370000_ga_j2b_crash_auto_bet.sql`](../supabase/migrations/20260608370000_ga_j2b_crash_auto_bet.sql) | `auto_bet_sessions` columns only |
| `crash_sync_v1` modified? | **No** |
| `idx_auto_bet_phase` (user suggestion) | **N/A** — not on crash_sync path |

---

## Step 2.3 — Mitigation applied

### Option 1: Index (APPLIED via MCP)

```sql
CREATE INDEX IF NOT EXISTS idx_game_active_sessions_user_game_round
  ON public.game_active_sessions (user_id, game, round_id)
  WHERE status = 'active';
```

- Forward-only, `IF NOT EXISTS`
- Before: only `idx_game_active_sessions_user_game (user_id, game)` — **no round_id**
- After: Index Scan on new composite index

### Option 2: Connection pool warm-up — **NOT APPLIED** (index insufficient alone; defer follow-up)

### Option 3: Nested RPC inline — **N/A** (`crash_sync_v1` has no nested RPC calls)

---

## Step 2.4 — RECHECK (보강 3: 3-RPC)

| RPC | Phase | Before p95 | After p95 | Δ | Regression? |
|-----|-------|------------|-----------|---|-------------|
| **crash_sync_v1** | warm | 458.0 ms | **396.6 ms** | −13% | mitigation target |
| crash_place_v1 | warm | 515.8 ms | 359.2 ms | −30% | **No** (<30% increase) |
| crash_cashout_v1 | warm | 388.8 ms | 414.3 ms | +7% | **No** |

| RPC | Phase | Before p99 | After p99 |
|-----|-------|------------|-----------|
| crash_sync_v1 | warm | 595.0 ms | 654.8 ms |

### RECHECK verdict

| Target | Result |
|--------|--------|
| warm p95 < 150 ms | **FAIL** (396.6 ms) |
| INSERT/UPDATE regression | **PASS** (no >30% increase) |
| `bun run smoke:crash-rpc` | **ALL PASS** |

Index improved sync p95 ~13% but **cannot close ~160ms RTT floor** from Korea → Supabase region.

---

## Before / After summary

| | Before | After | RECHECK |
|--|--------|-------|---------|
| sync warm p95 | 458 ms | 397 ms | **FAIL** |
| sync warm p99 | 595 ms | 655 ms | FAIL |
| place warm p95 | 516 ms | 359 ms | — |
| cashout warm p95 | 389 ms | 414 ms | — |
| Mitigation | — | `idx_game_active_sessions_user_game_round` | kept |
| Rollback | — | not needed (no regression) | — |

---

## Follow-up PR 후보 (Day B 밖)

1. **Edge/regional:** Supabase region proximity, Edge Function co-location, or client-side sync debounce
2. **Pool warm-up:** pg_cron ping (Option 2) — marginal if RTT-dominated
3. **Target revision:** p95 <150ms may require **in-region measurement** or end-user RTT budget separate from DB SLO

---

## 보강 적용 내역

| # | Content |
|---|---------|
| 1 | RTP sim safety — separate doc |
| 2 | Identical benchmark env documented + JSON artifacts |
| 3 | 3-RPC warm p95 before/after + 30% regression gate |

Raw: [`docs/crash-latency-before.json`](./crash-latency-before.json), [`docs/crash-latency-after.json`](./crash-latency-after.json)

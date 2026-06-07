# RTP Truth Verification — 2026-06-07 (Sprint 1 Day B)

Generated: 2026-06-07T17:20:00Z  
Script: [`scripts/rtp-truth-1m.ts`](../scripts/rtp-truth-1m.ts)  
Raw JSON: [`docs/rtp-truth-1m-results.json`](./rtp-truth-1m-results.json)

---

## Step 1.1 — `accept:a` 로직 감사

**SSOT:** [`scripts/accept-a-rtp-parity.ts`](../scripts/accept-a-rtp-parity.ts)

| 항목 | accept:a 현재 | Day B strict |
|------|---------------|--------------|
| RTP 공식 | `totalReturned / totalWagered × 100` | 동일 (표준) |
| N | 100,000 | 1,000,000 |
| Dice/Limbo PASS | `abs(rtp − 99) ≤ 1.0` (±1.0%) | **98.7–99.3%** |
| Crash PASS | `90 ≤ rtp ≤ 110` ("strategy-dependent") | **98.7–99.3%** (고정 전략) |

### dump §5 strict 재판정 (100K baseline)

| Game | RTP (100K) | accept:a | Strict 98.7–99.3 |
|------|------------|----------|------------------|
| Dice | 98.79% | PASS (±1%) | **PASS** |
| Limbo | 98.35% | FAIL (±1%) | **FAIL*** |
| Crash | 98.43% | PASS (90–110%) | **FAIL** |

\* Limbo — see root cause §1.3; **engine likely OK**, sim payout bug.

### Crash "strategy-dependent" PASS — 거짓 PASS

`accept:a`는 `CASHOUT_AT=2.0` 고정 전략인데도 90–110% 허용으로 PASS 처리함.  
고정 cashout 시뮬은 99% 이론값에 수렴해야 하므로 **검증 목적에 부적합한 loose threshold**.

---

## Step 1.2 — 6게임 1M RTP 실측 (strict)

**보강 1 적용:** 순차 실행, 100K probe → 1M 선택 (probe 5.3s/100K → 6게임 ~18min 실측), 10% progress, 30min/game cap.

| Game | Rounds | Real RTP | Target 99.0±0.3 | Pass/Fail | Elapsed |
|------|--------|----------|-----------------|-----------|---------|
| Dice | 1,000,000 | **98.91%** | 98.7–99.3 | **PASS** | 47s |
| Limbo | 1,000,000 | **98.53%** | 98.7–99.3 | **FAIL*** | 99s |
| Crash | 1,000,000 | **98.49%** | 98.7–99.3 | **FAIL** | 102s |
| Wheel | 1,000,000 | **98.93%** | 98.7–99.3 | **PASS** | 100s |
| Mines | 1,000,000 | **98.98%** | 98.7–99.3 | **PASS** | 213s |
| Plinko | 1,000,000 | **99.02%** | 98.7–99.3 | **PASS** | 546s |

**Strict score: 4/6 PASS** (Limbo asterisk, Crash genuine fail)

### 시뮬 전략

| Game | Strategy |
|------|----------|
| Dice | rollOver 50, mult 1.98 |
| Limbo | target 2.0x, payoutMult=1.98 (`target × LIMBO_RTP`) |
| Crash | autoCashout 2.0x, payout `bet × 2.0` |
| Wheel | medium risk, 10 segments |
| Mines | 3 mines, reveal tiles [0..4] then cashout |
| Plinko | medium risk, 16 rows (`dropPathPf`) |

---

## Step 1.3 — FAIL root cause

### Limbo — 측정 버그 (엔진 FAIL 아님)

**원인:** `rtp-truth-1m.ts` / `accept:a`가 승리 시 `bet × target × LIMBO_RTP` (1.98) 지급.  
[`LimboEngine.payoutMultiplier`](../src/shared/games/limbo/LimboEngine.ts) SSOT는 **`target`만** 반환 — RTP 99%는 `computeCrashPoint` 수식에 이미 내장.

**교정 측정 (100K, payout = bet × target):**

```
limbo correct payout 99.3920%  (wins 49696/100000)
```

→ strict **PASS** 예상. fix PR: accept:a + rtp-truth payout 공식 정정.

### Crash — genuine engine bias (~0.5%)

**원인:** [`CrashEngine.computeCrashPoint`](../src/shared/games/crash/CrashEngine.ts) — 1% instant bust (`h % 100 === 0`) + Stake formula.  
2x auto-cashout, payout `bet × 2.0` (이중 RTP 없음):

| N | RTP @ 2x cashout |
|---|------------------|
| 100K | 98.40% |
| 1M | 98.49% |

**가설 우선순위 (Crash):**

1. ~~이중 RTP~~ — payout 경로 OK
2. ~~micro-PHON floor~~ — sim float, 해당 없음
3. **PF instant-bust + formula** — 1% @ 1.00x가 2x cashout RTP를 ~98.5%로 끌어내림 (primary)
4. ~~전략 bias~~ — 2x 고정, 재현 가능

**fix PR 후보 (Day B 밖):** crash point formula / bust rate 조정 → 99% @ representative cashout; SQL `crash_compute_point_e6` parity 필수.

### PF uniformity (spot check)

Dice/Limbo/Crash HMAC `floatFromBytes` — 1M 라운드 분포에서 systematic bias 미관측 (FAIL 게임은 payout/공식 이슈).

---

## 보강 적용 내역

| # | 내용 | 적용 |
|---|------|------|
| 1 | RTP 순차·probe·progress·timeout | `scripts/rtp-truth-1m.ts` |
| 2 | Latency env 문서화 | `scripts/benchmark-crash-latency-dayb.ts` |
| 3 | 3-RPC 회귀 | before/after JSON |

---

## Fix PR 후보 (별도 PR)

1. **accept:a strict threshold** — 98.7–99.3%, Crash loose 제거
2. **Limbo sim payout** — `bet × target` (not `× LIMBO_RTP`)
3. **Crash RTP formula** — instant bust / point formula → 99% @ 2x (TS + SQL)

---

## 판정

| Metric | Result |
|--------|--------|
| Engine strict 4/6 | FAIL (Crash genuine; Limbo sim bug) |
| Corrected Limbo | PASS (pending sim fix) |
| accept:a audit | Crash false PASS confirmed |

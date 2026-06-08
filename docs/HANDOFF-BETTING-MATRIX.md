# earn-flow 게임 베팅 품질 — 세션 인계문 (SSOT)

> **작성:** 2026-06-08  
> **목적:** 새 Cursor 채팅에서 Stake/Rollbit 수준 betting 검증 작업을 이어가기 위한 전체 컨텍스트  
> **이전 대화:** agent transcript `1c28e7f7-6b56-4475-93ee-16ad93319e06`

---

## 1. 사용자 목표 (한 줄)

**6개 구현 게임(dice, limbo, crash, wheel, plinko, mines) — demo + real 전부 Stake.com / Rollbit 압살 수준: 오류 0, 오차 0, 렉 0.**

유저 입장에서 베팅·정산·복구 한 번 틀어지면 이탈 → 비즈니스 리스크. Money path + PF parity + UX 모두 zero tolerance.

---

## 2. 현재 판정 (2026-06-08 hardening update)

| 항목 | 상태 |
|------|------|
| **E2E betting matrix 13/13** | ✅ 최신 세션에서 2회 연속 PASS 기록 있음 |
| Demo 6게임 | ✅ PASS baseline. 단, 비로그인 demo는 local-only로 고정 |
| Real 6게임 | ✅ PASS baseline. real/server authority/PF RPC는 authenticated-only |
| RPC smoke (6게임) | ✅ `forensic:betting:fast` PASS 기록 |
| Supabase PF/auth root cause | ✅ `pf_session_create_or_get_v1`은 authenticated-only; 403은 unauthenticated/anon call이 원인 |
| Anonymous auth 422 | ✅ 클라이언트에서 anonymous signup 시도 제거 |
| Crash cashout→bust race | ✅ 서버 `cashed` terminal 수신 시 `cashedAt`을 phase 종료 전에 고정 |
| `bun run check` | ✅ GREEN (335 tests + build) |
| Proof ladder | ✅ matrix 13/13×2, forensic:fast, smokes, accept:a/b/d |
| Post-work audit | PASS with notes (optional GA flags 3건 정보성) |

### 최신 hardening 증거

```text
Supabase live audit:
  - pf_session_create_or_get_v1 / set_client_seed / rotate: authenticated EXECUTE only, anon denied
  - RLS enabled on pf_sessions, user_settings, game_active_sessions, wallet_balances, plinko_queue, auto_bet_sessions
  - Auth logs confirmed anonymous_provider_disabled 422
  - API logs confirmed pf_session_create_or_get_v1 403 before authenticated PF calls later succeeded
  - game_authority_flags: server authority 100% for crash/dice/limbo/wheel/plinko, kill_switch=false

Targeted regression:
  bun vitest run src/shared/mode/__tests__/ModeContext.spec.tsx \
    src/lib/auth/__tests__/ensureAnonymousSession.spec.ts \
    src/lib/gameSessions/__tests__/crashSessionUtils.spec.ts
  Result: 3 files / 18 tests PASS
```

### E2E 실행 이력 (반복 패턴)

| 실행 | 결과 | 주요 FAIL |
|------|------|-----------|
| 초기 | demo 6/6, real 3/6 | limbo/wheel/plinko `MONEY_IDEMPOTENCY_CONFLICT` |
| nonce 격리 후 | 12/13 | mines real |
| 셀렉터 fix 후 | demo 5~6/6 flake | crash demo idle 65s, wheel console/dice PF |
| mines real 단독 | 7/8 | **mines real waitForRoundActive** |

**이전 실패 원인 정리:** 초기 matrix flake는 E2E wait/RPC schema/session hygiene 문제였고, 최신 라이브 장애는 authenticated-only PF RPC를 비인증 상태에서 호출한 것이 핵심이었다. 이제 비로그인은 demo local-only로 고정하고, 로그인 사용자의 demo/real만 서버 authority/PF 경로를 사용한다.

---

## 3. 아키텍처 SSOT (절대 위반 금지)

| 항목 | 값 |
|------|-----|
| Supabase | **phonara-gb** (`kanftnqenuzverroodev`) ONLY — `.mcp.json` scoped |
| Money | Atomic RPC only — client balance 발행/수정 금지 |
| Demo | `walletStore` localStorage |
| Real | Supabase RPC + `useGameWallet` + TanStack Query |
| Game Authority | `*_place_v1` / sync / complete, Resume-First, feature flag |
| State | Zustand 도입 금지 |
| E2E betting | serial `workers=1`, demo project → real project, **`retries=0`** |
| 금지 수정 | `botGenerator`, `LiveBetsFeed`, `liveTickScheduler`, `live_bets` 트리거 |
| Git | commit/push/PR — 사용자 명시 요청 전 금지 |

---

## 4. E2E Betting Matrix 구조

### 프로젝트 체인

```text
setup (auth.setup.ts)
  → betting-matrix-demo  (6 tests: dice→limbo→crash→wheel→plinko→mines)
  → betting-matrix-real  (6 tests, demo PASS dependency)
```

### 명령

```bash
# 전체 matrix (~5–7분, flake 시 더 김)
bun run test:e2e:betting

# 단일 게임 (디버그 — matrix 전체 돌리지 말 것)
E2E_KEEP_ARTIFACTS=1 bun playwright test --project=betting-matrix-real -g "mines: real" --workers=1
E2E_KEEP_ARTIFACTS=1 bun playwright test --project=betting-matrix-demo -g "crash: demo" --workers=1

# RPC only (E2E와 분리)
bun run forensic:betting:fast
bun run smoke:mines-rpc   # 등 개별 smoke

# 품질 게이트 (13/13 후)
bun run check
bun run cleanup:workspace

# 아티팩트 청소 (에이전트 필수)
bun run test:e2e:cleanup
```

### `runBettingCase` 플로우 (`e2e/utils/betting-matrix.ts`)

1. `prepareGameForMatrixTest(name, mode)` — server mode + session clear
2. `clearActiveSessionsForGame` — per-game hygiene
3. `page.addInitScript` — `phonara.mode` + isolated nonce (`betting-init.ts`)
4. `goto(route)` + `expectHealthyPage`
5. (crash 제외) `waitForRoundIdle` — Resume-First in-flight round 완료 대기
6. crash/mines stale cashout resume
7. `placeBetIfReady` → `waitForRoundActive` → `completeGameRound` → `waitForRoundIdle`
8. `assertNoBlockingRpcFailures` + console errors 0

---

## 5. 이번 세션에서 적용한 수정 (미커밋)

### E2E 인프라

| 파일 | 변경 |
|------|------|
| `e2e/pages/game.page.ts` | `data-testid` bet button, crash/wheel/mines wait logic, timeout tuning |
| `e2e/utils/betting-init.ts` | **NEW** — per-game/mode nonce base (real 811k–861k) |
| `e2e/utils/betting-matrix.ts` | resume idle wait, session prep |
| `e2e/utils/reset-betting-state.ts` | per-game prep |
| `e2e/utils/rpc-monitor.ts` | WebSocket Realtime console benign filter |
| `playwright.config.ts` | betting: `workers=1`, `retries=0`, `timeout=150s`, `actionTimeout=10s` |
| `scripts/smoke-utils.ts` | `forceClearGameSession`, `hardResetE2eBettingState`, plinko queue clear |

### 프로덕션 UX / 버그 fix

| 파일 | 변경 |
|------|------|
| `src/shared/games/ui/StakeBetPanel.tsx` | `data-testid="stake-bet-submit"`, idle 시 「준비 중」 표시 |
| `src/features/games/mines/useMinesLifecycle.ts` | `restoreReady` gate (real mode server restore 완료 전 bet 차단) |
| `src/features/games/mines/MinesScreen.tsx` | `canPlace`에 `restoreReady` 연동 |
| `src/shared/games/plinko/usePlinkoRound.ts` | duplicate complete `.catch()` |

### 핵심 버그 fix: E2E 셀렉터

**문제:** `getByRole("button", { name: "베팅" })` — PF 로딩·잔액 부족 시 버튼 텍스트가 **「준비 중」** → locator **不存在** → 15s timeout 무한.

**해결:** `StakeBetPanel`에 `data-testid="stake-bet-submit"`, poll은 enabled 상태까지 대기.

### Nonce 격리 (real idempotency)

```typescript
// e2e/utils/betting-init.ts
dice:  { demo: 11_000, real: 811_000 }
limbo: { demo: 21_000, real: 821_000 }
crash: { demo: 31_000, real: 831_000 }
wheel: { demo: 41_000, real: 841_000 }
plinko:{ demo: 51_000, real: 851_000 }
mines: { demo: 61_000, real: 861_000 }
// + attempt offset per retry
```

→ demo↔real `MONEY_IDEMPOTENCY_CONFLICT` (limbo/wheel/plinko) **해결됨**.

### Crash E2E tuning

- init `pendingTarget: 1.01` (auto-cashout 빠르게)
- `ROUND_IDLE_MS.crash` demo **65s** (고배수 crash point running 대기)
- `waitForRoundActive`: cashout 못 보면 「라운드 진행 중」 fallback
- `completeGameRound` → `waitForRoundIdle` 위임 (exact text `"라운드 진행 중"` 버그 제거 — crash는 `"라운드 진행 중 — 위에서 캐쉬아웃"`)

### Wheel E2E

- spin 중 `hasActiveBet={!round.isIdle}` → submit 버튼 **DOM에서 제거**
- `/라운드 진행 중/` regex poll + goto 후 idle 대기

### Mines E2E (partial)

- real: `waitForResponse(mines_start_round_v1)` before click (race fix 시도)
- prod: `restoreReady` — **여전히 real E2E FAIL**

---

## 6. 게임별 `canPlace` 조건 (E2E가 기다려야 하는 신호)

| 게임 | canPlace true | E2E 함정 |
|------|---------------|----------|
| dice | `round.isIdle && !activeBet && pf.ready` | server hydrate → activeBet stuck |
| limbo | `round.isIdle && !activeRound && pf.ready` | 동일 |
| crash | `phase === "betting" && !bet && pf.ready && restoreReady` | **5초 betting window만** enabled |
| wheel | `round.isIdle && !activeRound && pf.ready` | spin 중 submit **hidden** |
| plinko | `queueSize < cap && pf.ready` | queue stuck |
| mines | `round.isIdle && pf.ready && (demo \|\| restoreReady)` | real restore race |

---

## 7. 최신 P0 root cause와 조치

### ✅ PF 403 / anonymous 422

**확정 원인:** live DB에서 `pf_session_create_or_get_v1`, `pf_session_set_client_seed_v1`, `pf_session_rotate_v1` 모두 `authenticated` EXECUTE only / `anon` denied. Supabase Auth 로그는 `anonymous_provider_disabled` 422를 기록했다. 따라서 anonymous auth가 꺼진 상태에서 앱이 anonymous signup 또는 PF RPC를 시도하면 422/403이 정상 발생한다.

**조치:** `ensureAnonymousSession`은 더 이상 `signInAnonymously()`를 호출하지 않는다. `ModeProvider`는 Supabase configured + unauthenticated 상태에서 localStorage의 이전 `real` 값을 무시하고 `demo`로 고정한다. 비로그인 demo는 local-only이며 서버 PF/RPC를 호출하지 않는다.

### ✅ Crash cashout 표시가 bust로 바뀌는 race

**확정 원인:** 서버 sync가 `cashed` 또는 cashout 후 `idle` terminal을 반환해도, `crashed` phase settle effect가 실행되기 전에 local `bet.cashedAt`/store `activeRound.cashedAt`이 고정되지 않으면 loss branch로 떨어질 수 있었다.

**조치:** `CrashScreen.applyServerSync`가 `terminal.cashedOut`을 받으면 `settleCashoutUi()`를 먼저 호출해 cashout terminal state를 고정하고, 이후 `setCrashPoint`/`setPhase("crashed")`로 진행한다.

### Demo mode decision

**판정:** demo는 유지하되 authority model을 분리한다.

- 비로그인 demo: local-only wallet/PF fallback, no Supabase PF/session/money RPC.
- 로그인 demo: server-authoritative non-money ledger (`bet_amount=0`) where game flags are enabled.
- real: authenticated-only money/PF/session RPC.

---

---

## 8. E2E timeout 상수 (현재값)

```typescript
// e2e/pages/game.page.ts
BET_READY_MS:
  dice demo 25s / real 28s
  crash demo 22s / real 28s
  wheel demo 35s / real 40s
  mines demo 25s / real 30s

ROUND_IDLE_MS:
  crash demo 65s / real 70s
  mines demo 28s / real 32s
```

`playwright.config.ts` betting projects: **timeout 150_000**, actionTimeout 10_000.

---

## 9. 초기 세션에서 진단했던 이슈 (참고)

### 20분 E2E hang (mines demo)

- Playwright `actionTimeout=0` → disabled tile infinite click
- Mines cashout regex `캐시?아웃`이 `−` 버튼 매칭 — **`캐쉬아웃`** orthography
- `handlePlace` async — bet click before `playing` phase

### Parallel 6-worker → serial 1-worker

- Vite overload, session conflict → `workers=1` 고정

### Real idempotency

- demo↔real 동일 round_id → `MONEY_IDEMPOTENCY_CONFLICT` → nonce base 분리로 해결

---

## 10. 파일 맵

```text
e2e/
  pages/game.page.ts              ← 모든 wait/click SSOT
  utils/betting-matrix.ts         ← runBettingCase
  utils/betting-init.ts           ← nonce + localStorage init
  utils/reset-betting-state.ts
  utils/rpc-monitor.ts
  utils/betting-assertions.ts
  tests/betting-demo.auth-ed.spec.ts
  tests/betting-real.auth-ed.spec.ts
playwright.config.ts

scripts/
  smoke-utils.ts                  ← session clear hygiene
  forensic-betting-suite.ts
  smoke-*-rpc.ts                  ← per-game RPC smoke

src/
  shared/games/ui/StakeBetPanel.tsx
  features/games/crash/CrashScreen.tsx
  features/games/mines/useMinesLifecycle.ts
  features/games/mines/MinesScreen.tsx
  lib/api/minesSession.ts
  lib/api/crashSession.ts
  lib/api/diceSession.ts

docs/
  PHONARA-GAME-AUTHORITY-PLAN-v3-FINAL.md
  PHONARA-GAME-AUTHORITY-COMPLETION-REPORT.md
  .cursor/rules/post-work-audit.mdc
  .cursor/rules/money-safety.mdc
  .cursor/rules/e2e-standards.mdc
```

---

## 11. 완료 체크리스트 (hardening 세션)

```text
[x] Supabase PF/auth root cause — authenticated-only grants, anon 403/422 원인 확정
[x] Crash cashout→bust race — applyServerSync cashedAt 선고정
[x] Guest mode — unauthenticated → local-only demo, anonymous signup 제거
[x] E2E nonce — run-unique offset (MONEY_IDEMPOTENCY_CONFLICT 방지)
[x] bun run test:e2e:betting — 13/13 × 2회 연속 PASS
[x] bun run forensic:betting:fast — ALL PASS
[x] bun run check — GREEN
[x] 2차 감사 (post-work-audit.mdc) — PASS with notes
[ ] P0 다음: real/auth canPlace 통일 + StakeBetPanel disabled reason (§15)
[ ] P1 수동 브라우저 6게임 체크리스트 (§15)
[ ] (선택) bun run forensic:betting — full E2E UI 12칸
```

---

## 12. 하지 말 것

- betting matrix `workers > 1` 또는 `retries > 0`으로 flake 숨기기
- 타임아웃만 2배씩 늘리기 (근본 미해결)
- Lovable에 supabase / lib/api / types.ts 수정 요청
- phonetok / phonara-world-main Supabase 사용
- test-results / playwright-report 커밋

---

## 13. 새 채팅 첫 메시지 템플릿

```text
@docs/HANDOFF-BETTING-MATRIX.md §15 기준으로 P0 real/auth canPlace 통일부터.

현재: matrix 13/13×2, check GREEN. 다음 blocker = 비로그인/미준비 real에서 베팅 버튼 활성 → RPC/토스트 실패.

완료 기준: 6게임 canPlace + StakeBetPanel disabled reason → vitest → matrix 1회 → check.
```

---

## 14. 2차 감사 보고 형식 (완료 시)

```text
## 2차 점검 (Post-Work Audit)
판정: PERFECT | PASS with notes | BLOCKED
- Money: ...
- PF/수식: ...
- Smoke/테스트: ...
- 금지영역: ...
청소: cleanup:workspace ✓
```

---

## 15. 다음 작업 (Next Work) — 2026-06-08 확정

P0 hardening 완료. 자동 게이트는 green. **다음은 사용자 체감 UX 구멍(real/auth readiness)과 운영 마무리.**

### P0 — Real 베팅 UX 게이트 통일 (가장 먼저)

**목표:** 비로그인·미준비 상태에서 베팅 버튼이 켜졌다가 토스트/RPC로 실패하지 않게 한다.

| 대상 | 현재 문제 | 해야 할 일 |
|------|-----------|------------|
| `MinesScreen` / `useMinesLifecycle` | real `canPlace`가 `restoreReady`만 봄 | `wallet.isRealReady` 또는 `auth.status === "authenticated"`를 `canPlace`에 포함 |
| `usePlinkoRound` / `PlinkoBoard` | `canPlace = queueSize && pf.ready`만 | real일 때 `isRealReady` + server authority 조건 추가 |
| `Dice` / `Limbo` / `Wheel` / `Crash` | `canPlace`에 PF/phase만, real auth 없음 | `mode !== "real" \|\| isRealReady`를 `canPlace`/`canPlaceBet`에 추가 |
| `StakeBetPanel` | “준비 중” vs “로그인 필요” 미구분 | `disabledReason` 또는 `realReady` prop, 로그인 CTA/메시지 중앙화 |

**완료 기준:** 비로그인 real에서 베팅 버튼 비활성 + 명확한 안내. RPC/토스트 실패 0.

**예상 범위:** 6게임 screen + `StakeBetPanel` + vitest.

### P1 — 수동 운영 검증

자동 게이트 통과 후 브라우저에서 1회씩:

- 로그인 후 demo/real 전환
- Crash 수동 cashout → bust 아닌 cashout 결과
- 새로고침 resume
- 비로그인 → demo만, real 불가
- 6게임 manual bet (demo + real)

**완료 기준:** 403/422/“네트워크 오류” 토스트 0.

### P2 — Supabase optional flags (블로커 아님)

forensic preflight optional missing:

- `mines_v2_cashout`
- `plinko_hmac`
- `mines_server_settle`

live `game_authority_flags` vs migration/문서 정합성 확인. 필요 시 INSERT migration 또는 문서에 “의도적 미사용” 명시.

### P2 — Full forensic (선택)

```bash
bun run forensic:betting   # E2E UI 12칸 포함 (fast는 --skip-e2e)
```

### P3 — 제품 방향 (당장 필수 아님)

- **Anonymous auth:** Supabase enable vs **현재 모델 유지** (비로그인 = local demo, real = 로그인 필수). 현재 코드는 후자.
- **`/provably-fair` 검증 페이지** — GA 잔여, 별도 라운드.

### 하지 말 것

- Supabase RPC/RLS 무분별 migration (403 원인은 grant drift가 아니라 auth 모델)
- Matrix `workers > 1` / timeout만 늘리기
- Demo 제거 (판정: **유지**, authority만 분리)

### 추천 실행 순서 (한 세션)

```text
1. P0 Real canPlace + StakeBetPanel disabled reason
2. vitest + matrix 13/13 1회 + bun run check
3. P1 수동 브라우저 6게임 체크리스트
4. (선택) bun run forensic:betting full
```

---

*이 문서는 Cursor agent 세션(베팅 forensic + E2E stabilization + hardening)의 대화·진단·수정·테스트 결과를 SSOT로 통합한 것이다. 업데이트 시 최신 E2E 결과와 git diff를 반영할 것.*

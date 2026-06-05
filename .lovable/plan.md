# ROUND L-1 — Crash 비주얼 · 공통 폴리시 (단일 슬롯) · 1 PR

## 목표
- `CrashScreen.tsx` ~413줄 → ≤250줄 목표 (Wheel 445 / Dice 370 선례 — 미달 시 종료 보고에 delta 명시, 300줄대 예상)
- Canvas particle/wash 비주얼 강화 + ROUND 0/K 공통 SSOT 정렬
- 새로고침 복원(`activeRound`) + hold-to-confirm cashout(150ms) + PF 시드 변경 시 refund 도입
- 단일 슬롯 ONLY. 멀티 슬롯 3(L-2) 금지.

## 0-diff 보호 (절대 금지)
- `src/shared/games/crash/CrashEngine.ts` — 수학/상수/export 전부
- `src/shared/games/ui/StakeBetPanel.tsx` — props·`onPlace`·`onCashout`·`bettingRoundKey` 계약
- `src/shared/wallet/useGameWallet.ts`, `walletStore.ts`
- `supabase/`, `src/lib/api/`, `vite.config.ts`
- `crashStore` version=2, key `phonara.gamestate.crash.v2`
- Crash 외 5게임(Dice/Wheel/Mines/Limbo/Plinko) Screen
- 4-phase 머신: `betting | running | crashed | cooldown` 유지
- `useGameRound` 도입 금지 (4-phase + betting timer + sharedTickLoop 매핑 불완전)

## 수정 파일

### 1. `src/shared/games/state/persistedGameState.ts`
- `ActiveCrashRound` interface 신규:
  - `nonce, amount, autoTarget, cashedAt(null), liveBetId, placedAt, crashPoint`
  - `startedAt: number` — running 진입 시 `performance.now()` 스냅샷 (0 = 아직 betting)
  - **`bettingStartedAt: number`** — **betting phase 진입 시점(라운드 타이머 시작)의 `performance.now()` 스냅샷**. place 시 `activeRound`에 그 값을 복사. **`placedAt`(베팅 클릭 시각)과 혼동 금지** — place 시각을 넣으면 refresh 후 betting 타이머가 어긋남.
- `CrashPersisted`에 `clientSeed: string` + `activeRound: ActiveCrashRound | null` 추가
- `createGameStore("crash", initial, 2)` — version=2 유지, 머지 `{ ...initial, ...parsed }` 로 legacy v2 호환

### 2. `src/shared/games/rules/gameRules.ts`
- `CRASH_RULES` 본문 0-diff
- 「단축키」섹션 추가: Space(betting 베팅) / C·Enter(캐쉬아웃 150ms 홀드) / P(공정성) / M(음소거)

### 3. `src/shared/games/crash/CrashCanvas.tsx`
- `sharedTickLoop` 단일 RAF 유지 (직접 rAF 금지)
- running: 곡선 헤드 particle trail 강화 (oklch 토큰 only, raw hex 0)
- crashed: rose radial wash 강화 (Screen `animate-crash-shake`와 시각 동기)
- `useReducedMotion()` ON → trail/particle 밀도 축소 또는 off
- Props 시그니처·수학·`CrashEngine` import 0-diff

### 4. `src/features/games/crash/CrashScreen.tsx` (≤250줄 목표 / 300줄대 예상)

공통 인프라 정렬:
- `GameShell` 슬롯 분리 — 4-phase 깨지면 outer layout만 유지하고 나머지 인프라는 필수
- `HistoryPillStrip` — 인라인 `<ul>` 교체 (`{ id, multiplier }` 네이티브)
- `ProvablyFairModal` + `ProvablyFairRow[]` — 인라인 sheet + `Row` 헬퍼 삭제
- `SessionStatsBar` + `recordSessionOutcome` — cashout=win, bust=loss
- `useHotkeys` — Space / C / Enter / P / M (input focus 시 무시)
- `useSfx` — bet / cashout / loss(bust) / tick(running 200ms interval)
- `useRegisterMainMode('game')` 유지

PF 정책 (K/J 정렬):
- `SERVER_SEED` 상수 유지, 하드코드 `CLIENT_SEED` 삭제
- `computeCrashPoint({ serverSeed, clientSeed: crashStore.get().clientSeed || "phonara-player-001", nonce })`
- **PF apply 시:**
  1. `activeRound != null && cashedAt === null` → `refund(activeRound.amount)` 1회 (unmount refund와 동일 정책 — Crash는 place 시 즉시 debit이라 seed reset만 하면 돈이 샘)
  2. 그다음 `clientSeed` 갱신 + `nonce=0` + `activeRound=null` + `lastOutcome=null` + 진행 bet/phase 리셋
- 시드 변경 toast만 유지. 일반 bet/bust/cashout `appToast` 제거

hold-to-confirm cashout (150ms):
- `BetSummaryPanel`에 `holdConfirmMs?: number` optional prop 추가
- **적용 조건:** `variant==="live" && onCashout` 있을 때만. static/Dice 사용 경로는 prop 미전달 → 기존 onClick 100% 동일. 시그니처 호환성 보존.
- 터치/마우스: pointerdown 타이머 → pointerup <150ms cancel, ≥150ms fire
- 키보드: C/Enter `keydown` hold 타이머 → `keyup` <150ms cancel (instant cashout과 혼동 금지)
- cancel 시 SFX 없음
- `StakeBetPanel` 미수정

activeRound 영속 + 복원 (이중 차감 절대 금지):
- **betting 진입 effect:** `bettingStartedAt = performance.now()` 스냅샷을 별도 ref/state로 보관 (라운드 시작 시각, place 여부 무관)
- place 성공: `activeRound = { nonce, amount, autoTarget, cashedAt:null, liveBetId, placedAt: now, crashPoint, startedAt: 0, bettingStartedAt: <위 스냅샷> }`
- running 진입: `startedAt` 스냅샷 store 반영
- manual/auto cashout: `activeRound.cashedAt` 갱신 (store + local 동시)
- crashed settle 완료: `activeRound=null` (`settledRef` 가드)
- **마운트 복원 (1회, `restoredRef`):**
  - `activeRound != null && 미settle`
  - `startedAt > 0` → running 복원 (`elapsed = now - startedAt`, tick loop 재구독)
  - `startedAt === 0 && bettingStartedAt > 0` → betting 복원 (`bettingMsLeft = BETTING_MS - (now - bettingStartedAt)`, ≤0이면 즉시 running 전환)
  - `tryDebit`/`liveBetsStore.push` **0회** (store/local 동기화만)
- unmount refund (`betRef + refund() if cashedAt===null`) 100% 보존
- **Screen 상단 주석:** place/cashout/settle/restore 시 store↔local 동기화 규칙 + `bettingStartedAt vs placedAt` 의미 차이 명시

계약 0-diff (재확인):
```
canPlace={phase === "betting"}
hasActiveBet={!!bet && bet.cashedAt === null && phase === "running"}
bettingRoundKey={nonce}                 // 문자 그대로
bettingProgress={bettingProgress}
suppressCashoutButton
onPlace={onStakePlace}
onCashout={handleCashout}
```
- `settledRef` 1회 settle 가드, crashed effect deps에 `bet` 없음
- `BETTING_MS` / `COOLDOWN_MS` / `multiplierAt` / `multiplierAt6` 그대로

### P-3 비대상
- `useRegisterRightRail` / `useDesktopLayout` / `CrashRightRail` 도입 X
- `LiveBetsFeed` — Screen 하단 항상 렌더 (desktop 분기 X)

## 신규 파일

### `src/features/games/crash/CrashMultiplierBadge.tsx`
- running/crashed 시 Canvas 위 live multiplier 오버레이 (font-numeric, tier 색)
- `getCurrentMultiplier()` 또는 props 수신
- `React.memo`, reduced-motion 시 pulse off
- Screen `displayArea` 내부 배치

### `src/shared/games/state/__tests__/crashStore.persist.spec.ts`
- key `phonara.gamestate.crash.v2` 불변 (v3 없음)
- legacy v2 (clientSeed/activeRound 없음) → 기본값 머지
- custom clientSeed + activeRound 저장본 그대로 로드

### `src/shared/games/state/__tests__/crashStore.restore.spec.ts`
- place → `activeRound` 세팅 + `bettingStartedAt`(`!== placedAt`) 포함 필드 검증
- cashout → `activeRound.cashedAt` 갱신
- settle(crashed) → `activeRound=null` + `lastOutcome` + `history`
- **PF seed 변경 (미정산 베팅): `refund` 호출 + `nonce=0` + `activeRound=null` + `lastOutcome=null`**
- (주석) 복원 hydrate 시 `tryDebit`/`liveBetsStore.push` 0회

## TODO 주석
```ts
// TODO(real-money): crash round settle via Edge Function + debit_phon_for_bet_v2 (Cursor)
```

## 기능 체크리스트
- Canvas particle trail + crashed rose wash
- hold-to-confirm cashout 150ms (touch + keyboard)
- SFX: bet / cashout / loss / tick(running)
- `HistoryPillStrip` + `SessionStatsBar`
- `ProvablyFairModal` (editable clientSeed) + 미정산 베팅 refund
- `activeRound` 영속 + betting/running 양쪽 refresh 복원 (이중 debit 0)
- `settledRef` + `betRef` + refund-on-unmount 보존
- auto-cashout (`reachedTarget` + `multiplierAt6`) 0-regression

## 종료 게이트
- `bun run lint:strict` — 0 warn
- `bun run check` — 114 → 116+ GREEN
- 수동 QA 6항목: betting→cashout(win) / betting→bust(loss) / auto-cashout / 새로고침(betting·running) 복원·잔액 불변 / PF seed 변화·미정산 refund / hotkeys+reduced-motion+타 게임 회귀 0
- Crash auto 3라운드 — 잔액·nonce 회귀 0
- `docs/lovable/ROUND_REPORT_TEMPLATE.md` 형식 종료 보고
- ≤250줄 미달 시: 현재 줄 수·원인·Wheel/Dice 대비 delta 명시

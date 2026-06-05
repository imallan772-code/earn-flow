
# P2 (승인본) — Limbo + Wheel, single-step on GameShell

P1에서 `GameShell` + `useGameRound(single/multi)` + Mines(multi)를 검증 완료. P2는 **single-step 경로**를 신규 2게임(Limbo, Wheel)으로 검증한다. HiLo·Keno·Roulette은 별도 라운드(P3~P5).

---

## 작업 순서

### 0. 사전 게이트
- `bun run lint:strict`
- `bun run test` — 기존 **57 GREEN (10 spec files)** baseline 확인
- 신규 문서: `src/shared/games/shell/ROUND_G_PART2_PLAN.md` (선정 근거 + MinesScreen single-step 패턴 재사용 명시)

### 1. Limbo (single-step, MinesScreen 패턴)

**엔진** `src/shared/games/limbo/LimboEngine.ts`
- `computeCrashPoint({serverSeed, clientSeed, nonce}) → number` — `bytesGenerator` 1회로 float `u ∈ (0,1)` → `crashPoint = max(1.00, floor(99 / (1 - u)) / 100)` (Stake 공식, RTP 99% 엔진 내장)
- `isWin(crashPoint, target)` = `crashPoint >= target` (경계 포함)
- `winChance(target)` = `99 / target` (%), `payoutMultiplier(target)` = `target` (모드 0.97은 `houseEdge.profitOf`로 이중 적용)
- 상수: `MIN_TARGET = 1.01`, `MAX_TARGET = 1_000_000`

**스토어** `persistedGameState.ts` — `limboStore` (v1): `{ nonce, history, lastOutcome, target: 2.0, pendingAmount: 10 }`

**규칙** `gameRules.ts` — `LIMBO_RULES` + `RULES_BY_GAME.limbo`

**화면** `src/features/games/limbo/LimboScreen.tsx` (목표 **120~160줄**)
- **MinesScreen single-step 패턴**: `useGameRound({ rollingMs: 700, settledMs: 900 })`, `GameShell` 슬롯 주입, phase=훅·영속=store
- 슬롯: `displayArea`=거대 멀티플라이어 `CountUp`(win=gold/loss=rose) · `controls`=target 입력 + 2×/÷2 · `summaryPanel`=`BetSummaryPanel(variant=static, winChancePct=99/target)` · `betPanel`=`StakeBetPanel(showAutoTarget=false, suppressCashoutButton)`
- `liveBetsStore.push("limbo")` / `update`, Provably Fair 모달 (Mines 패턴)

**라우트** `src/routes/_app/games.limbo.tsx` — `games.mines.tsx` 패턴(`head()` 포함)

**테스트** `__tests__/limboEngine.spec.ts` (6): 결정론 / `crashPoint ≥ 1.00` / target=2.0 승률 ≈ 49.5% (10k) / `payoutMultiplier(2)=2` / 극단값(1.01·1_000_000) / `isWin` 경계

### 2. Wheel (single-step, MinesScreen 패턴)

**엔진** `src/shared/games/wheel/WheelEngine.ts`
- risk 3 (`low|medium|high`) × segments 3 (`10|20|30`) Stake 표 (RTP 99% 내장)
- `getSegments(risk, segments) → readonly number[]`, `spin({...}, segments) → index` (`bytesGenerator` → `floor(u*segments)`), `multiplierAt(risk, segments, index) → number`

**스토어** `wheelStore` (v1): `{ nonce, history, lastOutcome, risk: "medium", segments: 20, pendingAmount: 10 }`

**규칙** `WHEEL_RULES` + `RULES_BY_GAME.wheel`

**화면** `src/features/games/wheel/WheelScreen.tsx` (목표 **140~180줄**)
- `useGameRound({ rollingMs: 1400, settledMs: 1000 })` + `GameShell`
- `displayArea`: SVG 휠, **@theme 토큰만**(0×=muted, ≤1=cyan, ≤2=emerald, ≤5=gold, >5=rose), framer-motion 회전(`LazyMotion` 활성), 고정 포인터
- `controls`: risk/segments segmented (idle만 변경 가능)

**라우트** `src/routes/_app/games.wheel.tsx` (mines 패턴 + `head()`)

**테스트** `__tests__/wheelEngine.spec.ts` (6): 세그먼트 길이 = segments / 평균 RTP ≈ 99% (±0.5%) / 결정론 / 인덱스 경계 / spin ∈ [0,segments) / 모든 risk×segments lookup 존재

### 3. SSOT 통합 — gameRegistry 갱신 (`GameLobby.tsx` 미수정)

- `src/shared/games/registry/gameRegistry.ts`:
  - `GameId` += `"limbo" | "wheel"`
  - `OpenGamePath` += `"/games/limbo" | "/games/wheel"`
  - `GAME_REGISTRY` 2건: `open: true`, `route: "/_app/games/limbo|wheel"`, `rules`, `accent: "purple"|"gold"`, `Icon: TrendingUp|Disc3`
- `src/mocks/gameLobby.ts`: `limbo`, `wheel` FOMO 카운트 (예: 198 / 263)
- `src/shared/livefeed/LiveBetsStore.ts`: `LiveGame` += `"limbo" | "wheel"` (타입만)
- **권장:** `src/shared/livefeed/botGenerator.ts` GAMES 배열에 `"limbo"`, `"wheel"` 추가 (FOMO 갭 해소)

### 4. 종료 게이트
- `bun run lint:strict` GREEN
- `bun run check` GREEN — **57 + 12 = 69 tests** + typecheck + build
- 수동 회귀: Dice/Crash/Mines/Plinko — 잔액·히스토리·새로고침 복원 0건 변화
- 수동 신규 (**390×844 무스크롤 시각 확인**): Limbo·Wheel 베팅→roll→settle→idle, 새로고침 복원, GameLobby에 LIVE 카드 2개

---

## 비대상
HiLo(P3) · Keno(P4) · Roulette(P5) · Plinko/Crash/Dice 셸 마이그레이션(P-Migration) · Live Feed 개편 · Race/Drops/Raffle · walletStore xp/vip/rakeback · Bet Slip/Hotkey/Sound/Haptic · Web Worker PF · react-window · `docs/backlog/LATER.md` 갱신(Cursor)

## 규칙
LOVABLE_WORK_RULES §3/§5/§6/§7/§8 · `supabase/`·`lib/api/`·`walletStore`·`types.ts` 미수정 · Tailwind v4 `@theme` 토큰만 · LazyMotion 패턴

## 영향 파일 (신규 9, 수정 5 [+권장 1])

**신규 9:** `LimboEngine.ts` · `limboEngine.spec.ts` · `LimboScreen.tsx` · `games.limbo.tsx` · `WheelEngine.ts` · `wheelEngine.spec.ts` · `WheelScreen.tsx` · `games.wheel.tsx` · `ROUND_G_PART2_PLAN.md`

**수정 5:** `persistedGameState.ts` · `gameRules.ts` · `gameRegistry.ts` · `mocks/gameLobby.ts` · `LiveBetsStore.ts`

**권장 1:** `botGenerator.ts`

**미수정:** `GameLobby.tsx` (SSOT = registry)

## 다음 라운드 (보관)
P3 HiLo (multi-step) · P4 Keno · P5 Roulette · P-Migration (Crash/Dice/Plinko → GameShell)

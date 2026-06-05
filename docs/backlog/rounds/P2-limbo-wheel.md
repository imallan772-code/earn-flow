# P2 라운드 — Limbo + Wheel (승인됨)

| 항목           | 값                                         |
| -------------- | ------------------------------------------ |
| **상태**       | ✅ Lovable 완료 (2026-06-05)               |
| **승인일**     | 2026-06-05                                 |
| **담당**       | 🤖 Lovable                                 |
| **베이스라인** | vitest **57** GREEN → 완료 후 **69** GREEN |
| **검토**       | Cursor 검토 의견 5건 전부 반영 (수정본)    |

---

## Lovable에 보낼 지시 (복붙용)

```text
P2 수정본 승인. 아래 플랜대로 착수해줘.

확인 사항:
- baseline vitest 57 GREEN → 완료 후 69 GREEN
- gameRegistry.ts + mocks/gameLobby.ts 갱신 (GameLobby.tsx 직접 수정 금지)
- Limbo/Wheel = MinesScreen single-step + GameShell + useGameRound
- 종료 게이트: bun run lint:strict && bun run check GREEN
- botGenerator에 limbo/wheel 추가 권장 (FOMO)
- 라우트 2개는 games.mines.tsx 패턴 (createFileRoute + head meta + Screen)

미수정: supabase/, lib/api/, walletStore, types.ts
전체 스펙: docs/backlog/rounds/P2-limbo-wheel.md
```

---

# P2 플랜 (수정본) — Limbo + Wheel 2종 (single-step)

P1에서 `GameShell` + `useGameRound(single/multi)` + Mines(multi)를 검증 완료. P2는 **single-step 경로**를 신규 2게임으로 검증한다. HiLo(multi)·Keno·Roulette은 별도 라운드(P3~P5)로 분리. 검토 의견 5건 전부 반영.

---

## 작업 순서

### 0. 사전 게이트 (정정)

- `bun run lint:strict`
- `bun run test` — 기존 **57 GREEN (10 spec files)** 확인 (P1 누적 baseline)
- Limbo/Wheel = **MinesScreen single-step 패턴** 재사용 (설계 SSOT: 본 문서 + `docs/lovable/BOUNDARIES.md`)

### 1. Limbo (single-step, MinesScreen 패턴 채택)

**엔진** `src/shared/games/limbo/LimboEngine.ts`

- `computeCrashPoint({serverSeed, clientSeed, nonce}) → number` — `bytesGenerator` 1회로 float ∈ (0,1) → `crashPoint = max(1.00, floor(99 / (1 - u)) / 100)` (Stake 공식, RTP 99% 엔진 내장)
- `isWin(crashPoint, target)` = `crashPoint >= target` (경계 포함)
- `winChance(target)` = `99 / target` (%)
- `payoutMultiplier(target)` = `target` (모드 0.97은 `houseEdge.profitOf`로 이중 적용)
- 상수: `MIN_TARGET = 1.01`, `MAX_TARGET = 1_000_000`

**스토어** `persistedGameState.ts` — `limboStore` 추가 (v1)

- shape: `{ nonce, history: LimboHistoryItem[], lastOutcome, target: 2.0, pendingAmount: 10 }`

**규칙** `gameRules.ts` — `LIMBO_RULES` + `RULES_BY_GAME.limbo`

**화면** `src/features/games/limbo/LimboScreen.tsx` (목표 **120~160줄**)

- **MinesScreen single-step 패턴**: `useGameRound({ rollingMs: 700, settledMs: 900 })`, `GameShell` 슬롯 주입, phase는 훅·영속은 store
- 슬롯:
  - `displayArea`: 거대 멀티플라이어 카운트업 (`CountUp` 재사용, win=gold/loss=rose)
  - `controls`: target multiplier 입력 (1.01~1_000_000, 0.01 step) + 2× / ÷2 빠른 버튼
  - `summaryPanel`: `BetSummaryPanel(variant=static, winChancePct=99/target)`
  - `betPanel`: `StakeBetPanel(showAutoTarget=false, suppressCashoutButton)`
- `liveBetsStore.push("limbo")` / `update`
- Provably Fair 모달 (Mines 모달 패턴)

**라우트** `src/routes/_app/games.limbo.tsx` — `games.mines.tsx` 패턴 (head meta 포함)

**테스트** `__tests__/limboEngine.spec.ts` (6 케이스): 결정론 / `crashPoint ≥ 1.00` / target=2.00 승률 ≈ 49.5% (10k 샘플) / `payoutMultiplier(2)=2` / 극단 입력 (1.01·1_000_000) / `isWin` 경계 (`crashPoint == target` → win)

### 2. Wheel (single-step, MinesScreen 패턴 채택)

**엔진** `src/shared/games/wheel/WheelEngine.ts`

- 세그먼트 테이블: risk 3종 (`low|medium|high`) × segments 3종 (`10|20|30`) — Stake 표 (RTP 99% 내장)
- `getSegments(risk, segments) → readonly number[]`
- `spin({...}, segments) → index` (`bytesGenerator` → `idx = floor(u * segments)`)
- `multiplierAt(risk, segments, index) → number`

**스토어** `wheelStore` 추가 (v1) — shape: `{ nonce, history, lastOutcome, risk: "medium", segments: 20, pendingAmount: 10 }`

**규칙** `WHEEL_RULES` + `RULES_BY_GAME.wheel`

**화면** `src/features/games/wheel/WheelScreen.tsx` (목표 **140~180줄**)

- `useGameRound({ rollingMs: 1400, settledMs: 1000 })` single-step + `GameShell`
- `displayArea`: SVG 휠, 세그먼트 색상은 **@theme 토큰만** (0×=muted, ≤1=cyan, ≤2=emerald, ≤5=gold, >5=rose). 회전 = framer-motion (LazyMotion 이미 활성). 포인터 고정.
- `controls`: risk/segments segmented (idle일 때만 변경)
- 나머지 = Limbo와 동일

**라우트** `src/routes/_app/games.wheel.tsx` — `games.mines.tsx` 패턴

**테스트** `__tests__/wheelEngine.spec.ts` (6 케이스): 세그먼트 길이 = segments / 평균 RTP ≈ 99% (±0.5%) / 결정론 / 인덱스 경계 / spin ∈ [0, segments) / 모든 risk×segments lookup 존재

### 3. SSOT 통합 — gameRegistry 갱신 (검토 의견 #2 반영)

**`GameLobby.tsx`는 SSOT registry만 소비 → 직접 수정 금지.** registry만 갱신하면 카드/링크 자동 반영.

- `src/shared/games/registry/gameRegistry.ts`:
  - `GameId` union에 `"limbo" | "wheel"` 추가
  - `OpenGamePath`에 `/games/limbo` | `/games/wheel` 추가
  - `GAME_REGISTRY` 항목 2개 추가: `open: true`, `route: "/_app/games/limbo|wheel"`, `rules: LIMBO_RULES|WHEEL_RULES`, `accent: "purple"|"gold"`, `Icon: TrendingUp|Disc3`
- `src/mocks/gameLobby.ts`: `limbo`, `wheel` FOMO 카운트 추가 (예: 198 / 263)
- `src/shared/livefeed/LiveBetsStore.ts`: `LiveGame` union에 `"limbo" | "wheel"` 추가 (타입만)
- **선택(권장):** `src/shared/livefeed/botGenerator.ts`의 GAMES 배열에 `"limbo"`, `"wheel"` 추가 (FOMO 갭 해소, ~2줄)

### 4. 검증 게이트 (정정 — repo SSOT 기준)

- `bun run lint:strict`
- `bun run test` — **57 + 12 = 69 GREEN**
- `bun run check` GREEN (typecheck + test + build)
- 수동 회귀: Dice/Crash/Mines/Plinko 동작·잔액·히스토리·새로고침 복원 0건 변화
- 수동 신규 (**390×844 viewport 무스크롤 시각 확인 포함**): Limbo·Wheel 베팅→roll→settle→idle, 새로고침 시 nonce/history/target/risk/segments 복원, GameLobby에 Limbo·Wheel 카드 LIVE 표시

---

## 비대상 (이번 라운드 안 함)

HiLo(P3 multi-step), Keno(P4), Roulette(P5), Plinko 셸 마이그레이션, Crash/Dice 셸 마이그레이션, Live Feed 개편, RAF 봇 개편, Race/Drops/Raffle, walletStore xp/vip/rakeback, Bet Slip/Hotkey/Sound/Haptic, Web Worker PF, react-window, `docs/backlog/LATER.md` 갱신(Cursor 후속).

## 규칙 준수

- LOVABLE_WORK_RULES §3(zustand 금지) / §5(셸 순수) / §6(금전 보수: `tryDebit`+`credit`+`profitOf` 이중 RTP) / §7(파일 상단 주석 + `TODO(real-money)`) / §8(엔진 분리)
- Lovable 미수정: `supabase/`, `lib/api/`, `walletStore` 스키마, `types.ts`
- Tailwind v4 `@theme` 토큰만 (raw hex 0건)
- Framer Motion `LazyMotion` 패턴

## 영향 파일 (신규 9, 수정 5 [+선택 1])

**신규 8:**

- `src/shared/games/limbo/LimboEngine.ts`
- `src/shared/games/limbo/__tests__/limboEngine.spec.ts`
- `src/features/games/limbo/LimboScreen.tsx`
- `src/routes/_app/games.limbo.tsx`
- `src/shared/games/wheel/WheelEngine.ts`
- `src/shared/games/wheel/__tests__/wheelEngine.spec.ts`
- `src/features/games/wheel/WheelScreen.tsx`
- `src/routes/_app/games.wheel.tsx`

**수정 5:**

- `src/shared/games/state/persistedGameState.ts` (limboStore + wheelStore)
- `src/shared/games/rules/gameRules.ts` (LIMBO_RULES + WHEEL_RULES + RULES_BY_GAME)
- `src/shared/games/registry/gameRegistry.ts` (GameId/OpenGamePath/GAME_REGISTRY 2건)
- `src/mocks/gameLobby.ts` (limbo/wheel FOMO 카운트)
- `src/shared/livefeed/LiveBetsStore.ts` (LiveGame union 확장)

**선택 1 (권장):** `src/shared/livefeed/botGenerator.ts` (GAMES 배열에 limbo/wheel 추가)

**미수정:** `GameLobby.tsx` (SSOT는 registry)

## Cursor 이관 (라운드 종료 후)

1. `git pull`
2. `bun run lint:strict && bun run check`
3. `docs/backlog/LATER.md` — P3~P5 로드맵 갱신
4. 본 문서 상태 → `✅ Lovable 완료` + 완료일 기록

## 다음 라운드 후보 (보관)

- **P3**: HiLo (multi-step, 카드 덱 + 외부 `settle()`)
- **P4**: Keno (격자 25 선택, 단일 추첨)
- **P5**: Roulette (테이블 UX 별도 디자인 라운드)
- **P-Migration**: Crash/Dice/Plinko를 GameShell로 일괄 이전 (P2~P4 누적 GREEN 후)

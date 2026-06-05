# All Games "끝판왕" Final Roadmap v2.1 (승인·SSOT)

| 항목 | 값 |
| ---- | -- |
| **상태** | ✅ ROUND 0 완료 (Cursor) — 다음: **ROUND I (Limbo)** |
| **승인일** | 2026-06-05 |
| **담당** | 🤖 Lovable (UI/UX) → 🔧 Cursor (pull·감사·money·Realtime) |
| **베이스라인** | vitest **71+** GREEN (`bun run check` SSOT) |
| **검토** | Cursor 검토 6건 + v2.1 선택 3건 반영 |

**목표:** UI·UX·체감 성능을 Lovable 규칙 안에서 최대치까지 끌어올림. 이후 Cursor가 Supabase Realtime / RPC / wallet / Edge PF 시드로 real-money·멀티플레이어 완성.

**실행 큐 (고정):**

```text
ROUND 0 (1 PR) → I → J → K → L-1 → M → [Mines H Cursor GREEN] → N → O
```

라운드당 **1 PR**. 한 번에 여러 라운드 묶음 금지. 각 라운드 종료 → GitHub push → Cursor pull → `docs/CURSOR_SANITATION_CHECKLIST.md` → `bun run check` GREEN → 다음.

---

## Lovable 매 라운드 복붙 (헤더)

```text
=== PHONARA earn-flow · Lovable 라운드 시작 ===

아래 문서를 모두 준수 (순서):
1. docs/lovable/PROMPT_HEADER.md
2. docs/lovable/BOUNDARIES.md
3. docs/LOVABLE_WORK_RULES.md
4. docs/TECH_STACK.md
5. docs/backlog/rounds/GAMES-ROADMAP-v2.1.md (본 로드맵 — 해당 ROUND 섹션만)

전체 로드맵 SSOT: docs/backlog/rounds/GAMES-ROADMAP-v2.1.md
```

---

## 절대 원칙 (전 라운드 공통)

- **미접촉:** `supabase/`, `src/integrations/supabase/`, `src/lib/api/`, `src/shared/wallet/walletStore.ts` 스키마, `vitest.config.ts`, `src/test/setup.ts`, `.cursor/`, `AGENTS.md`
- **시그니처 보존:** 모든 `*Engine.ts` 수학, `GameShell`, `useGameRound`, **`StakeBetPanel` props 계약 (`onPlace` / `lastOutcome` / `bettingRoundKey`)**, `BetSummaryPanel`, `LiveBetsStore`, **`usePlinkoRound` export**
- **스택 고정:** TanStack Start v1, React 19, TS strict, Tailwind v4 `@theme` (raw hex 0), Framer Motion `LazyMotion` + `m.*` + `useReducedMotion`
- **영속 store:** `version` 유지 + `{ ...initial, ...parsed }` 머지 (migrate 금지)
- **돈 규칙:** demo만; real-money는 `// TODO(real-money): <rpc> (Cursor)` 주석
- **Screen 본문 250줄 이하** (Mines N은 400↓ 예외 — Display·Controls 분리 게이트로 보완), Display·Controls·Panel 분리, `React.memo` + `useMemo` + `useCallback`
- **SSR 가드 필수:** `navigator.share` / `navigator.vibrate` / Web Audio / `window` 참조 = `typeof window !== "undefined"` + `useEffect`
- **종료 게이트:** `bun run lint:strict` (0 warn) + `bun run check` GREEN + 수동 QA 6항목 (테스트 수는 참고치 — **71+ 누적 GREEN이 SSOT**)

### 종료 게이트 (전 라운드 통일)

```text
1. bun run lint:strict      # 0 warnings
2. bun run check            # 71+ 누적 GREEN + build success
3. 수동 QA 6항목:
   a. 베팅 → 결과 (win/loss) 정상
   b. 새로고침 중간 복원 (잔액 불변)
   c. PF seed 변경 → 결과 변화
   d. 키보드 단축키 전부 동작
   e. reduced-motion ON → 정상
   f. 다른 게임·StakeBetPanel auto·dedupe 회귀 0건
4. SSR 가드 확인 (navigator.*, Web Audio)
```

---

## ROUND 0 — 공통 인프라 (필수 선행, 1 PR) ✅

> **완료:** 2026-06-05 — Cursor. vitest **90** passed, `bun run check` GREEN. vitest include에서 Playwright E2E 분리.

이후 7라운드가 전부 의존. **AutoBetPanel 신규 금지 — StakeBetPanel 확장만.**

### v2.1 — `useAutoBetController` 추출 규칙 (불변)

- `placedNonceRef` / `placingAutoRef` / `bettingRoundKey` / `debit === false` 시 ref 리셋 로직은 **「이동만, 동작 변경 금지」**
- **회귀 테스트:** Dice·Crash auto **3라운드 연속** 실행 → 잔액·nonce 변화량 리팩터 전후 **100% 일치**

### 신규

| 경로 | 역할 |
| ---- | ---- |
| `src/shared/sfx/SfxEngine.ts` | Web Audio 단일 진입점 (`bet`/`win`/`loss`/`tick`/`cashout`/`jackpot`/`peg`), SSR 가드, AudioContext lazy/suspend, mute store, reduced-motion 자동 mute |
| `src/shared/sfx/useSfx.ts` | React 훅 |
| `src/shared/sfx/__tests__/SfxEngine.spec.ts` | 결정론 + mute |
| `src/shared/hooks/useHotkeys.ts` | `useHotkeys({ Space: ... })`, input/textarea/contentEditable 제외 |
| `src/shared/hooks/useTilt.ts` | CSS transform 3D tilt, reduced-motion off, SSR 가드 |
| `src/shared/hooks/useShareResult.ts` | `navigator.share` → PNG download fallback, SSR 가드 |
| `src/shared/games/ui/AutoBetConfigFields.tsx` | StakeBetPanel Auto 탭 입력 묶음 (**단독 패널 아님**) |
| `src/shared/games/ui/useAutoBetController.ts` | `autoBet.ts` reducer wiring (**StakeBetPanel `onPlace` 계약 불변**) |
| `src/shared/games/ui/RoundResultCard.tsx` | 결과 floating card 1.6s |
| `src/shared/games/ui/ShareResultButton.tsx` | Canvas2D → PNG |
| `src/shared/games/ui/SessionStatsBar.tsx` | 세션 P/L·최고 배수·연승/연패 (**메모리 derive only, 영속 X**) |
| `src/shared/games/ui/ProvablyFairModal.tsx` | 7게임 공통 PF (Mines H에서 추출) |
| `src/shared/games/ui/HistoryPillStrip.tsx` | 그라데이션 pill + 클릭 → PF |
| `src/shared/games/ui/__tests__/AutoBetConfigFields.spec.tsx` | |
| `src/shared/games/ui/__tests__/ProvablyFairModal.spec.tsx` | |
| `src/shared/hooks/__tests__/useHotkeys.spec.ts` | |

### 수정

- `src/shared/games/ui/StakeBetPanel.tsx` — Auto 탭을 `AutoBetConfigFields` + `useAutoBetController`로 리팩터. **props·`bettingRoundKey`·debit 재시도 dedupe 보존** (Cursor 수정분 건드리지 않음)
- `src/styles.css` — sfx 볼륨 토큰, multiplier 그라데이션 4단계 토큰
- `src/shared/games/state/persistedGameState.ts` — `sfxStore`({ enabled, volume }) v1. **sessionStats는 메모리 only.** walletStore key와 분리

### 미수정

게임 Engine, 게임 Screen

### ROUND 0 게이트 추가

- StakeBetPanel 회귀 0: Dice/Crash/Mines/Plinko/Limbo/Wheel 전부 베팅·결과·auto 3라운드

### Lovable 복붙 (ROUND 0 착수)

```text
ROUND 0 착수. docs/backlog/rounds/GAMES-ROADMAP-v2.1.md § ROUND 0 전체 준수.

필수:
- PROMPT_HEADER.md 맨 위
- AutoBetPanel 신규 금지
- useAutoBetController = placedNonceRef/placingAutoRef/bettingRoundKey/debit false 리셋 "이동만"
- 회귀: Dice·Crash auto 3라운드 연속, 잔액·nonce 변화량 일치
- SSR 가드: SfxEngine, useShareResult, useTilt
- 종료: bun run lint:strict && bun run check GREEN

미수정: supabase/, lib/api/, walletStore, *Engine.ts, 게임 Screen
종료 보고: docs/lovable/ROUND_REPORT_TEMPLATE.md
```

---

## ROUND I — Limbo 끝판왕

| Screen | 현재 → 목표 | 선행 |
| ------ | ----------- | ---- |
| Limbo | 356 → 230↓ | `LimboDisplay` 추출 |

### v2.1 — 멀티슬롯 정책

- 멀티슬롯 2개 = **manual 전용**
- Auto 탭은 **활성 슬롯 1개**에서만 노출 (동시 자동베팅 2개 **금지**)

**수정:** `LimboScreen.tsx`, `persistedGameState.ts` (limboStore: `clientSeed`, `activeRounds: ActiveLimbo[2]`, v1), `gameRules.ts`  
**신규:** `LimboDisplay.tsx`, `LimboMultiSlot.tsx`, `limboStore.persist.spec.ts`, `limboStore.restore.spec.ts`  
**미수정:** `LimboEngine.ts`, `StakeBetPanel` 계약

**기능:** 거대 멀티 카운트업, target stepper + 칩, 슬롯 2 (manual), StakeBetPanel Auto(활성 1), SFX, HistoryPill, PF, RoundResultCard, Share, SessionStats, useTilt, hotkeys, activeRounds 영속 (700ms rolling)

---

## ROUND J — Wheel 끝판왕

| Screen | 현재 → 목표 | 선행 |
| ------ | ----------- | ---- |
| Wheel | 448 → 240↓ | **`WheelDisplay` 추출 필수** |

**수정:** `WheelScreen.tsx`, `persistedGameState.ts` (wheelStore: `clientSeed`, `activeRound`), `gameRules.ts`  
**신규:** `WheelDisplay.tsx`, `WheelSegment.tsx`, 2 store specs  
**미수정:** `WheelEngine.ts`, `StakeBetPanel` 계약

**기능:** SVG 3D perspective, 0× 비네팅, segmented (idle), 공통 인프라, hotkeys, activeRound 영속 (1400ms)

---

## ROUND K — Dice 끝판왕

| Screen | 현재 → 목표 |
| ------ | ----------- |
| Dice | 267 → 210↓ |

**수정:** `DiceScreen.tsx`, `DiceSlider.tsx`, `DiceResultDisplay.tsx`, `persistedGameState.ts` (diceStore: `clientSeed`, v2), `gameRules.ts`  
**신규:** `dice.persist.spec.ts`  
**미수정:** `DiceEngine.ts`, `StakeBetPanel` 계약

**기능:** 슬라이더 햅틱+SFX, 결과 bounce, over/under morph, target 칩, 공통 인프라, hotkeys

---

## ROUND L-1 — Crash 비주얼·공통 폴리시 (단일 슬롯)

| Screen | 현재 → 목표 | 선행 |
| ------ | ----------- | ---- |
| Crash | 380 → 250↓ | CrashCanvas 외 디스플레이 분리 |

**수정:** `CrashScreen.tsx`, `CrashCanvas.tsx`, `persistedGameState.ts` (crashStore: `clientSeed`, `activeRound` 단일, v2), `gameRules.ts`  
**신규:** `CrashMultiplierBadge.tsx`, 2 store specs  
**미수정:** `CrashEngine.ts`, **`StakeBetPanel` 계약**, `useGameWallet`, `settledRef`, `bettingRoundKey={nonce}`

**기능:** Canvas 트레일·셰이크, hold-to-confirm cashout 150ms, 공통 인프라, hotkeys, activeRound 영속 (단일)

**비대상 (L-2):** 멀티 슬롯 3, `activeRounds[3]`, 슬롯별 cashout → Cursor 또는 후속 Lovable L-2 (money path 설계 후)

---

## ROUND M — Plinko 끝판왕

| Screen | 현재 |
| ------ | ---- |
| Plinko | 68 (유지 — Board/Renderer 핵심) |

**수정:** `PlinkoBoard.tsx` (**내부 5공 큐 + `handlePlace` 연타**), `PlinkoCanvasView.tsx`, `PlinkoRenderer.ts`, **`PlinkoSFX.ts` → SfxEngine 위임**, `persistedGameState.ts` (plinkoStore: `clientSeed`, v1), `gameRules.ts`  
**신규:** `PlinkoSlotRow.tsx`, 1 store spec  
**미수정:** `PlinkoEngine.ts`, **`usePlinkoRound` export 시그니처 100% 불변**

**기능:** 5공 큐, peg 글로우, 슬롯 잔광, `useRngWorker` PF 사전계산, 공통 인프라, hotkeys, reduced-motion=단일 공

---

## ROUND N — Mines 추가 폴리시

### 선행 조건 (필수)

Mines ROUND H Cursor pull → **`bun run check` GREEN** → N 착수  
(참고: [`MINES-round-H.md`](./MINES-round-H.md))

| Screen | 현재 → 목표 |
| ------ | ----------- |
| Mines | 774 → **400↓** |

### v2.1 — Mines 분리 게이트

종료 게이트에 추가:

```text
- MinesDisplay.tsx + MinesControls.tsx 파일 존재 확인
- MinesScreen 본문에서 해당 JSX·핸들러 제거 확인
  (줄 수만 줄고 로직 잔존하는 실패 방지)
```

**수정:** `MinesScreen.tsx`, `gameRules.ts` — 인라인 PF/History → 공통 컴포넌트  
**신규:** `MinesDisplay.tsx`, `MinesControls.tsx`  
**미수정:** `MinesEngine.ts`, `MinesTile.tsx`, `StakeBetPanel` 계약, minesStore version=1 (autobet은 StakeBetPanel)

**기능:** AutoBet(랜덤 N픽), SFX, RoundResultCard, Share, SessionStats, ProvablyFairModal, HistoryPillStrip

---

## ROUND O — Lobby & Live Feed

**수정:** `GameLobby.tsx`, `LiveBetsFeed.tsx` (react-window)  
**신규:** `GameCard3D.tsx`, `GameMiniStats.tsx`  
**의존:** `bun add react-window @types/react-window` (**로드맵 신규 dep 1회만**)

**기능:** 3D tilt 카드, sparkline (메모리 derive), feed 가상화 500행, 필터, hotkeys ↑↓

---

## 비대상 (Cursor 전담)

| 항목 | TODO 패턴 |
| ---- | --------- |
| 실시간 멀티/채팅 | `// TODO(realtime): Supabase channel (Cursor)` |
| 토너먼트/Race/Drops | `// TODO(real-money): tournament RPC (Cursor)` |
| 진짜 돈·VIP·rakeback | `// TODO(real-money): credit_phon RPC (Cursor)` |
| PF 서버 시드 | `// TODO(real-money): server_seed Edge Function (Cursor)` |
| Crash 멀티 슬롯 3 (L-2) | money path 설계 후 |
| E2E `games.auth-ed` selector | hold-to-confirm·신규 키 추가 시 Cursor |

---

## 라운드별 Screen 줄 수 (현재 baseline 2026-06-05)

| Screen | 현재 | 목표 | 비고 |
| ------ | ---- | ---- | ---- |
| Limbo | 356 | 230 | LimboDisplay |
| Wheel | 448 | 240 | WheelDisplay 필수 |
| Dice | 267 | 210 | |
| Crash | 380 | 250 | L-1 |
| Plinko | 68 | 유지 | Board/Renderer |
| Mines | 774 | 400 | N + 분리 게이트 |

---

## 최종 산출물 (8라운드 완료 후)

- 게임 7종 + Lobby: Stake/Rollbit급 인터랙션 (demo)
- 공통 인프라: SFX, Hotkeys, Tilt, StakeBetPanel auto, PF, HistoryPill, ResultCard, Share, SessionStats
- vitest **71+** 누적 GREEN (`bun run check`)
- Cursor: Realtime·RPC wiring → real-money 라이브

---

## 변경 이력

| 버전 | 날짜 | 내용 |
| ---- | ---- | ---- |
| v2 | 2026-06-05 | Cursor 검토 6건 반영 |
| v2.1 | 2026-06-05 | useAutoBetController 불변·Limbo auto 정책·Mines 분리 게이트 |

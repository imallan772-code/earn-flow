
## ROUND K — Dice 끝판왕 (1 PR)

목표: `DiceScreen` 267 → ≤210줄. Wheel(ROUND J) 수준의 공통 인프라 정렬. **DiceEngine·StakeBetPanel 계약·Supabase/lib/api/walletStore 0-diff.**

## 수정 파일

### 1. `src/shared/games/state/persistedGameState.ts` — diceStore 확장
- `DicePersisted`에 `clientSeed: string` 추가.
- `createGameStore("dice", initial, 2)` — **version=2 그대로**. localStorage key `phonara.gamestate.dice.v2` 불변.
- 머지 규칙 `{ ...initial, ...parsed }`로 기존 v2 저장본은 `clientSeed` 기본값만 주입 → migrate 불필요.
- 기본 `clientSeed = "phonara-player-001"` (기존 상수와 동일).

### 2. `src/shared/games/rules/gameRules.ts` — DICE_RULES
- "단축키" 섹션 추가 (Wheel과 동일 톤): Space 베팅 / ↑↓ target ±1 / Shift+↑↓ ±10 / O·U over/under / P 공정성 / M 음소거.
- 기존 5섹션 본문 0-diff.

### 3. `src/shared/games/dice/DiceSlider.tsx` — 햅틱 + SFX
- `onTargetChange` 래핑 시점에 `navigator.vibrate?.(8)` (SSR 가드: `typeof navigator !== "undefined" && "vibrate" in navigator`).
- `useSfx` 주입은 호출측(Screen)에서 prop `onTick?: () => void`로 전달 (Slider는 pure UI 유지). target 변경 시 호출.
- 모드 토글 클릭 시 `onModeChangeSfx?.()` 동일 패턴.
- 기존 마크업/토큰/접근성 0-diff.

### 4. `src/shared/games/dice/DiceResultDisplay.tsx` — bounce + reduced-motion
- `LazyMotion` + `domAnimation` + `m.div` 사용, `useReducedMotion()`로 settled bounce(`scale 1 → 1.08 → 1`, 360ms) 토글.
- 기존 `animate-result-pop` 클래스는 reduced-motion 시 폴백으로 유지.
- 색·레이아웃·MetaRow 0-diff.

### 5. `src/features/games/dice/DiceScreen.tsx` — ≤210줄, Wheel SSOT 정렬

채택할 공통 인프라 (Wheel과 동일):
- `GameShell` + `useGameRound({ rollingMs: 800, settledMs: 800 })`
- `HistoryPillStrip` (기존 인라인 `<ul>` 교체)
- `ProvablyFairModal` + `ProvablyFairRow[]` (인라인 bottom sheet + Row 헬퍼 삭제)
- `SessionStatsBar` + `recordSessionOutcome({ outcome, profit, multiplier })`
- `useHotkeys` 맵: Space=place, ArrowUp/Down=target±1 (Shift=±10), o/u=mode, p=PF, m=mute
- `useSfx`: `bet` / `win` / `loss` / `tick`(roll 중 200ms 인터벌) — Wheel 패턴
- `useRegisterMainMode('game')` 유지
- 일반 win/loss/bet `appToast` 호출 제거 (Wheel/Limbo 정렬). 시드 변경 토스트만 유지.

**HistoryPillStrip 매핑 (의도된 trade-off):**
- Dice history는 `roll` 값(0~99.99)이라 `multiplier`가 아님. Limbo가 `crashPoint`를 `multiplier` 필드에 넣는 패턴과 동일하게 `roll`을 `multiplier` 슬롯에 매핑:
  ```ts
  items={history.map(h => ({ id: h.id, multiplier: h.roll }))}
  ```
- pill 표시는 `xx.xx` + `x` suffix 형태로 노출됨 (수용). win/loss 색 분기는 strip 내장 tier 색으로 대체 — 의도된 trade-off.

**useGameRound nonce 정책 (Wheel과 다름 — 현행 유지):**
- Wheel: `place()` 성공 시 `nonce++`, idle 복귀 시 증가 없음.
- **Dice: idle 복귀 시 `nonce++` 현행 유지** (settled→idle effect 내부). Wheel 패턴을 그대로 복사하지 말 것. `useGameRound` 도입은 phase/effect 통합 용도만이며 nonce 증가 시점은 변경 없음.
- `activeBet.nonce`는 place 시점의 `diceStore.get().nonce` 스냅샷.

PF 정책:
- `SERVER_SEED` 상수 유지. 하드코드 `CLIENT_SEED` 상수 제거.
- `computeRoll`에 Wheel 패턴대로 `diceStore.get().clientSeed || "phonara-player-001"` 사용.
- PF 모달 적용 시: `clientSeed` 갱신 + `nonce=0` 리셋 + 진행중 베팅 폐기(`activeBet=null`, lastOutcome 클리어).

비대상(P-3): Desktop RightRail / `useRegisterRightRail` / `useDesktopLayout` — 도입 X. `LiveBetsFeed`는 현재 그대로 페이지 하단 유지.

## 신규 파일

### `src/shared/games/state/__tests__/dice.persist.spec.ts`
`wheelStore.persist.spec.ts` 패턴 그대로:
1. localStorage key `phonara.gamestate.dice.v2` 그대로 (v3 없음).
2. 기존 v2 저장본(`clientSeed` 없음) → 기본값 `"phonara-player-001"` 머지, 기존 필드(nonce/history/target/diceMode 등) 보존.
3. 신규 필드 포함 저장본은 그대로 로드 (`clientSeed: "custom-seed"`).

## 0-diff 보호 (절대 금지)

- `src/shared/games/dice/DiceEngine.ts`
- `StakeBetPanel` props / `onPlace` / `lastOutcome` / `bettingRoundKey` 계약
- `supabase/`, `src/lib/api/`, `src/shared/wallet/walletStore.ts`
- `vite.config.ts`
- diceStore version (2 유지) / localStorage key
- 6 게임 중 Dice 외 0-diff

## 종료 게이트

1. `bun run lint:strict` — 0 warn
2. `bun run check` — 111+ tests GREEN
3. 수동 QA 6항목 (로드맵 § 종료 게이트)
4. Dice auto 3라운드 — 잔액/nonce 회귀 0
5. **종료 보고: `docs/lovable/ROUND_REPORT_TEMPLATE.md` 필수** — 변경 파일·라인 수·QA 결과·0-diff 확인 기록.

## 기술 메모

- DiceScreen 라인 절감 경로: PF 인라인 sheet(~40줄) + `Row` 헬퍼(~8줄) + 인라인 history `<ul>`(~16줄) + 중복 토스트(~6줄) 제거 → GameShell wrapping(~20줄 추가) 감안 순감 ≥57줄 → ≤210줄 도달.
- `useGameRound` 도입으로 `phase` 로컬 useState + rolling/settled useEffect 두 개를 `round.phase` / `round.place()` 한 흐름으로 통합. **단 nonce 증가 시점은 idle 복귀 시(Dice 현행) 유지.**
- Dice는 Wheel과 달리 `activeRound` 영속화 미도입 (라운드 길이 800ms, 새로고침 복원 가치 낮음). `activeBet`는 컴포넌트 로컬 상태 유지.

승인하면 build 모드 전환 후 위 순서대로 작업.

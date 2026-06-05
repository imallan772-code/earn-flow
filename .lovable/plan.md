# ROUND I — Limbo 끝판왕 v2.1 final (Lovable, micro-fix 4건 반영)

**전제**: ROUND 0 main merge 완료 (0e1ffe2). 즉시 착수.
**SSOT**: `bun run check` GREEN 71+ 누적, `lint:strict` 0 warn → GitHub push.

## 절대 미접촉
- `LimboEngine.ts` 0줄 diff
- `StakeBetPanel` props 계약 변경 금지 (`showAutoTab` ❌, controlled tab ❌)
- `useAutoBetController` 로직 변경 금지
- `GameShell`, `useGameRound`, `walletStore`, `useGameWallet`, `liveBetsStore`
- `supabase/`, `src/integrations/supabase/`, `src/lib/api/`
- 다른 게임 화면 (Dice/Crash/Plinko/Mines/Wheel) 0줄 diff
- 신규 npm 0개. `vite.config.ts`·`vitest.config.ts` 미접촉
- localStorage key `phonara.gamestate.limbo.v1` 유지 (v1, migrate 없음)

## ROUND 0 산출물 import
- `@/shared/sfx/useSfx`
- `@/shared/hooks/useHotkeys`
- `@/shared/hooks/useTilt`
- `@/shared/hooks/useShareResult`
- `@/shared/games/ui/RoundResultCard`
- `@/shared/games/ui/ShareResultButton`
- `@/shared/games/ui/SessionStatsBar`
- **`@/shared/games/ui/sessionStats`** → `recordSessionOutcome` (micro-fix #1)
- `@/shared/games/ui/ProvablyFairModal`
- `@/shared/games/ui/HistoryPillStrip`

LazyMotion = `__root.tsx` 전역 — 추가 래핑 생략.

---

## 1) 영속 store (`persistedGameState.ts`, v1 유지)

```ts
export interface ActiveLimboRound {
  nonce: number; amount: number; target: number;
  liveBetId: string; placedAt: number; slot: 0 | 1;
}
export interface LimboPersisted {
  nonce: number;                                          // place 시 ++
  history: LimboHistoryItem[];
  lastOutcome: LimboOutcome | null;                       // 호환
  lastOutcomeBySlot: [LimboOutcome | null, LimboOutcome | null];
  target: number; pendingAmount: number;
  activeRounds: [ActiveLimboRound | null, ActiveLimboRound | null];
  clientSeed: string;                                     // 기본 "phonara-player-001"
  activeSlot: 0 | 1;
}
```

머지 `{...initial, ...parsed}`. 화면 상수 `CLIENT_SEED` 제거 → `store.clientSeed`.

## 2) 멀티슬롯 — useGameRound × 2

```ts
const rounds = [
  useGameRound({ rollingMs: 700, settledMs: 900 }),
  useGameRound({ rollingMs: 700, settledMs: 900 }),
];
```
- rolling/settle effect slot index별 분리
- **nonce**: `place(slot)` 성공 시 global `nonce++` 후 `ActiveLimboRound.nonce` 스냅샷. idle 복귀 시 nonce 불변
- **bettingRoundKey**: 활성 슬롯 full panel = `activeRounds[activeSlot]?.nonce ?? nonce`

## 3) StakeBetPanel 정책

| 슬롯 | 마운트 |
|---|---|
| 비활성 (manual) | `<StakeBetPanel variant="compact" showAutoTarget={false} lastOutcome={…[i]} ... />` |
| 활성 (manual+auto) | `<StakeBetPanel variant="full" showAutoTarget={false} key={`slot-${activeSlot}`} bettingRoundKey={…} lastOutcome={…[activeSlot]} ... />` |

- `key` remount → 슬롯 전환 시 auto 자동 정지
- `onPlace(amount, autoTarget)` 두 번째 인자 무시 (store target 사용)
- `lastOutcome` 슬롯별 wiring (micro-fix #3):
  ```ts
  lastOutcome={
    lastOutcomeBySlot[i]
      ? { outcome, profit, nonce: lastOutcomeBySlot[i].nonce }
      : null
  }
  ```

## 4) 화면 분리 (LimboScreen 356 → 230)

**신규**
- `LimboDisplay.tsx` (memo, per-slot): 거대 멀티 카운트업 `m.span`, ease-out `cubicBezier(0.16,1,0.3,1)`, won/lost 색, reduced-motion 즉시, `useTilt`
- `LimboMultiSlot.tsx` (memo): 슬롯 2개 = `LimboDisplay` + `BetSummaryPanel` + StakeBetPanel(위 정책), activeSlot 강조·토글
- `LimboTargetStepper.tsx` (memo): 칩 `[1.5,2,5,10,100]` + ±0.1/±1.0 + ÷2/2× (active slot의 다음 베팅 target)

**수정**: `LimboScreen.tsx` (356→230), `gameRules.ts` 단축키 1줄

**GameShell 슬롯**:
- `displayArea = <LimboMultiSlot ... />`
- `controls = <LimboTargetStepper ... />`
- `historyStrip = <><HistoryPillStrip ... /><SessionStatsBar /></>`
- `betPanel = <></>` (한 줄만 표시 — SessionStatsBar 중복 회피)

## 5) ROUND 0 wiring

- **SFX**: `bet` on place(slot) · `tick` on rolling · `win`/`loss` on settle(slot) · `jackpot` win ≥ 50×
- **HistoryPillStrip**: 매핑 `{ id: h.id, multiplier: h.crashPoint }`. 클릭 → PF 모달 해당 nonce
- **ProvablyFairModal**: 인라인 모달·`FairRow` 삭제 → 공통 모달. clientSeed 변경 시 nonce=0 + `activeRounds=[null,null]` + **`lastOutcomeBySlot=[null,null]`** + 토스트
- **RoundResultCard + Share 형제**:
  ```tsx
  <RoundResultCard ... />
  <ShareResultButton ... />
  ```
- **recordSessionOutcome (micro-fix #1, settle effect slot별)**:
  ```ts
  import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
  recordSessionOutcome({
    outcome: won ? "win" : "loss",
    profit,
    multiplier: won ? mult : undefined,
  });
  ```
  ※ `game` 필드 없음.
- **settle 시 동시 갱신**: `lastOutcome` + `lastOutcomeBySlot[i]` 둘 다 (호환 + 슬롯별 auto)

## 6) 키보드 (`useHotkeys`) — micro-fix #2, #4

```ts
useHotkeys({
  " ": () => placeActiveSlot(),               // Space (key.length===1 lowercase)
  ArrowUp: () => stepTarget(+0.1),
  ArrowDown: () => stepTarget(-0.1),
  "Shift+ArrowUp": () => stepTarget(+1.0),    // micro-fix #4: 별도 map key
  "Shift+ArrowDown": () => stepTarget(-1.0),  // micro-fix #4
  "1": () => setActiveSlot(0),
  "2": () => setActiveSlot(1),
  p: () => setShowFair(true),
  m: () => toggleMute(),
});
```
input/textarea 자동 제외. **Hotkey A 제외** — controlled tab 필요, Cursor 후속.

## 7) 복원 (이중 차감 금지)

마운트 시 각 슬롯 `activeRounds[i] != null` →
- UI hydrate (amount/target/liveBetId/nonce)
- `rounds[i].place()` — state hydrate만
- **`tryDebit` / `liveBetsStore.push` 호출 0건**
- settle 시 `activeRounds[i] = null`

## 8) 테스트

- `limboStore.persist.spec.ts`: v1 JSON(신규 필드 없음) → 기본값 머지 (`activeRounds=[null,null]`, `lastOutcomeBySlot=[null,null]`, `clientSeed` 기본)
- `limboStore.restore.spec.ts`: store-level 두 슬롯 active set 검증. mount 가능 시 `tryDebit` mock 0회

## 9) 종료 게이트

1. `bun run lint:strict` 0 warn
2. `bun run check` GREEN 71+ 누적
3. 수동 QA 6:
   - 슬롯 1·2 동시 manual → 각자 settle, nonce 중복 X
   - 진행 중 새로고침 → 양 슬롯 복원, 잔액 변화 0
   - 활성 슬롯 auto → 슬롯 전환 시 auto 자동 정지
   - PF 시드 변경 → nonce 0 + activeRounds + lastOutcomeBySlot 클리어
   - 키보드 Space/↑↓/Shift+↑↓/1/2/P/M (Shift는 별도 map key)
   - reduced-motion ON + SSR 가드 크래시 X
4. 회귀: Dice/Crash/Mines/Plinko/Wheel/Lobby 0건
5. `supabase/` 변경 0건
6. GitHub push

## Cursor pull audit 체크리스트
- `useAutoBetController` diff = 0
- `LimboEngine.ts` diff = 0
- 다른 게임 Screen diff = 0
- HistoryPillStrip 매핑 `{ id, multiplier: h.crashPoint }`
- 슬롯 전환 = `key` remount
- `recordSessionOutcome` no `game` field, sessionStats 모듈 import
- Shift hotkey = `"Shift+ArrowUp"` map key (not `e.shiftKey` 분기)

## 파일 요약

**Modified (3)**
- `src/features/games/limbo/LimboScreen.tsx` (356 → 230)
- `src/shared/games/state/persistedGameState.ts` (LimboPersisted 확장, v1)
- `src/shared/games/rules/gameRules.ts` (단축키 1줄)

**Created (5)**
- `src/features/games/limbo/LimboDisplay.tsx`
- `src/features/games/limbo/LimboMultiSlot.tsx`
- `src/features/games/limbo/LimboTargetStepper.tsx`
- `src/shared/games/state/__tests__/limboStore.persist.spec.ts`
- `src/shared/games/state/__tests__/limboStore.restore.spec.ts`

## 비대상 (Cursor 후속)
Hotkey A · 멀티플레이어 · 진짜 돈 정산·VIP·rakeback · PF Edge Function · E2E selector

## 다음 라운드
ROUND J (Wheel) — ROUND I Cursor audit GREEN 후

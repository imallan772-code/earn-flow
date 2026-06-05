# ROUND J — Wheel 끝판왕 v1.2 (Design B + Cursor audit 6패치 반영)

**전제**: ROUND I main merge GREEN. 즉시 착수.
**디자인**: 시안 B "Neon Pulse Casino" — 이중 베젤 중앙 허브, 풀 N세그먼트, 골드 포인터 + 테이퍼, ambient radial glow.
**SSOT 게이트**: `bun run lint:strict` 0 warn + `bun run check` GREEN (**100+** 누적) → GitHub push.

## 절대 미접촉
- `WheelEngine.ts` 0줄 diff (현재 80줄, PF spin 계약 유지)
- `StakeBetPanel` / `useAutoBetController` / `useGameRound` / `GameShell` props 계약
- `walletStore` / `useGameWallet` / `liveBetsStore`
- `supabase/`, `src/integrations/supabase/`, `src/lib/api/`
- 다른 게임 화면 (Dice/Crash/Mines/Plinko/Limbo/Lobby) 0줄 diff
- 신규 npm 0개. `vite.config.ts`·`vitest.config.ts` 미접촉
- **`src/styles.css` 미접촉** (keyframe 신규 금지 — Cursor 후속)
- localStorage key `phonara.gamestate.wheel.v1` 유지 (migrate 없음)

---

## 1) 영속 store 확장 (`persistedGameState.ts`, v1)

```ts
export interface ActiveWheelRound {
  nonce: number; amount: number;
  risk: "low" | "medium" | "high";
  segments: 10 | 20 | 30;
  liveBetId: string; placedAt: number;
}
export interface WheelPersisted {
  nonce: number;
  history: WheelHistoryItem[];
  lastOutcome: WheelOutcome | null;
  risk: "low" | "medium" | "high";
  segments: 10 | 20 | 30;
  pendingAmount: number;
  activeRound: ActiveWheelRound | null;   // 신규
  clientSeed: string;                      // 신규 ("phonara-player-001")
}
```
`createGameStore` 기본 머지(`{...initial, ...parsed}`)로 기존 저장본은 신규 필드 기본값 주입 — migrate 불필요. 화면 상수 `CLIENT_SEED` 제거 → `store.clientSeed`.

## 2) nonce 정책 (audit patch — 버그 픽스)
- **place() 성공 시 `nonce++`** → `ActiveWheelRound.nonce` 스냅샷
- **현재 코드의 "idle 복귀 시 nonce++ effect" 삭제**
- `bettingRoundKey={activeRound?.nonce ?? nonce}` (StakeBetPanel auto-loop 키)

---

## 3) 디자인 B — `WheelDisplay.tsx` (신규, memo)

### 색/글래스 SSOT (audit patch #1 — @theme only, raw tailwind palette 금지)
- glass 컨테이너: `glass-2` / `glass-3` 토큰 (Limbo와 동일, `glass-card` 금지)
- ambient: `radial-gradient` + `color-mix(in oklab, var(--color-cyan) 10%, transparent)`
- risk 색 매핑: `low=var(--color-cyan)` / `medium=var(--color-gold)` / `high=var(--color-rose)`
- 0× vignette: `color-mix(in oklab, var(--color-muted) 60%, var(--color-bg-0))`
- 포인터 골드: `bg-(--color-gold)` + `shadow-glow-gold` (기존 토큰) + ring + 아래 테이퍼 `linear-gradient(to bottom, var(--color-gold), transparent)`
- **금지**: `cyan-400`, `slate-800`, `text-black`, `text-white/40`, `border-white/5`, `shadow-[0_0_15px_cyan/40]` 등 raw tailwind palette / 인라인 hex

### 구조
- 컨테이너 `aspect-square rounded-[2.5rem] glass-2` + ambient radial
- 포인터(12시): 골드 원 `w-4 h-4` + ring + glow-gold + 테이퍼
- 휠 SVG `viewBox="0 0 100 100"`:
  - segments 동적 path (10/20/30) — Engine 테이블 참조
  - multiplier>0 → risk별 토큰 색 / multiplier===0 → 0× vignette + opacity 0.6 (**audit #3a**)
  - **idle segment labels** (audit #3b): `phase==="idle"`일 때 호 위 배수 텍스트. 10→11px / 20→9px / 30→7px
- 중앙 허브 (디자인 B 핵심): `w-32 h-32 rounded-full glass-3` + inset shadow + 4px border
  - 상단 라벨 "결과" `text-(--color-muted)`
  - 카운터: `text-3xl font-black` + `useMotionValue` count-up cubic-bezier `[0.16,1,0.3,1]`
  - `useTilt(6)` 호버 3D
  - 하단 펄스 바: 기존 `animate-phon-pulse` 재사용 (styles.css 미접촉)

### 모션 (Direction B "Glow 트레일·세그먼트 펄스")
- 회전: `m.svg` transform rotate, duration 3.2s ease-out, 결과 세그먼트 12시 정렬 (`-(index * segAngle) - segAngle/2 + 360*spins`)
- **Idle 펄스**: active risk 색 세그먼트만 `animate-phon-pulse` 재사용 (styles.css 미접촉 정책 — audit #2)
- **Settle glow trail**: 결과 세그먼트에 `filter: drop-shadow(0 0 12px <riskColor>)` Framer Motion 0.6s fade-out + 포인터 halo scale 1→1.3
- Jackpot (mult ≥ 9.0): 기존 `RewardBurst` 트리거
- **reduced-motion ON**: 회전 즉시 정렬, 펄스 OFF

---

## 4) `WheelControls.tsx` (신규, memo) — Design B 컨트롤

```tsx
<div className="glass-2 rounded-3xl p-5 flex flex-col gap-5">
  <Row label="위험도">  {/* 낮음/보통/높음 pill */}
  <Row label="세그먼트">{/* 10/20/30 pill */}
</div>
```
- active pill: `bg-(--color-cyan) text-(--color-bg-0) shadow-glow-cyan`
- inactive pill: `bg-(--color-surface-hi) text-(--color-muted)`
- `disabled = !isIdle`

---

## 5) `WheelScreen.tsx` 재작성 (468 → ~230)

**GameShell 슬롯**:
- `displayArea = <WheelDisplay ... />`
- `controls = <WheelControls ... />`
- `historyStrip = <><HistoryPillStrip /><SessionStatsBar /></>`
- `summaryPanel = <BetSummaryPanel variant="static" ... />`
- `betPanel`:
  ```tsx
  <StakeBetPanel
    variant="full" showAutoTarget={false}
    canPlace={round.isIdle}
    hasActiveBet={!round.isIdle}
    bettingRoundKey={activeRound?.nonce ?? nonce}    // audit
    balance={balance}
    lastOutcome={lastOutcome ? { outcome, profit, nonce } : null}
    onPlace={(amount) => void handlePlace(amount)}
    onCashout={() => {}}
  />
  ```

인라인 SVG / 인라인 PF 모달 / `FairRow` / 커스텀 history strip 삭제.

### 결과 UI (audit patch #4 — Limbo 정렬 채택 = 옵션 B)
- **`RoundResultCard` + `ShareResultButton` 제거** (허브와 시각 겹침)
- 결과는 중앙 허브 안 카운터 + jackpot 시 `RewardBurst`로 충분
- 공유는 PF 모달 내 "결과 공유" 버튼으로 통합 (모달 footer 한 줄)

### 토스트 정책 (audit patch #3)
- **일반 win/lose `appToast.game.*` 호출 전면 제거** (Limbo와 동일)
- bet placed toast도 제거
- **jackpot (mult ≥ 9.0) → SFX `jackpot` + `RewardBurst`만**

---

## 6) ROUND 0 wiring

- **SFX**: `bet` on place · `tick` 회전 중 200ms 주기 · `win`/`loss` on settle · `jackpot` mult ≥ 9.0
- **HistoryPillStrip**: `{ id, multiplier: h.multiplier }`. 클릭 → PF 모달 해당 nonce
- **ProvablyFairModal**: 공통 모달. clientSeed 변경 → `nonce=0` + `activeRound=null` + `lastOutcome=null` + 토스트 (PF 토스트는 OK)
- **recordSessionOutcome** (settle effect):
  ```ts
  import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
  recordSessionOutcome({ outcome: won ? "win" : "loss", profit, multiplier: won ? mult : undefined });
  ```
  ※ `game` 필드 없음.

---

## 7) 키보드 (`useHotkeys`)
```ts
useHotkeys({
  " ": () => placeIfIdle(),
  ArrowLeft: () => cycleRisk(-1),
  ArrowRight: () => cycleRisk(+1),
  "1": () => setSegments(10),
  "2": () => setSegments(20),
  "3": () => setSegments(30),
  p: () => setShowFair(true),
  m: () => toggleMute(),
});
```
rolling/settled 중 risk/segments 변경 무시.

### `gameRules.ts` — `WHEEL_RULES` 「단축키」 1개 **append**
기존 섹션 6개 보존. 추가:
```ts
{ title: "단축키",
  body: "• Space: 돌리기 · ←→: 난이도 바꾸기 · 1/2/3: 칸 10/20/30 · P: 공정성 · M: 소리 끄기" }
```

---

## 8) 복원 (이중 차감 금지 — audit patch #6)

마운트 시 `activeRound != null` →
1. UI hydrate (amount/risk/segments/liveBetId/nonce)
2. `round.place()` — state hydrate만 (**`tryDebit` / `liveBetsStore.push` 호출 0건**)
3. rolling effect에서 `spin({ nonce: activeRound.nonce, clientSeed: store.clientSeed })` 재실행 → **동일 결과 보장**
4. settle 시 `activeRound = null` (history/lastOutcome 같은 tick)

---

## 9) 테스트 (신규 2개 → 누적 100+)

- `wheelStore.persist.spec.ts`: v1 JSON(신규 필드 없음) → 기본값 머지 round-trip (`activeRound=null`, `clientSeed` 기본)
- `wheelStore.restore.spec.ts`: store-level `activeRound` set 후 rehydrate, `tryDebit` mock **0회**, `liveBetsStore.push` mock **0회**

`WheelEngine.spec.ts` 미접촉.

---

## 10) 종료 게이트

1. `bun run lint:strict` 0 warn
2. `bun run check` GREEN — **100+** 누적 (현재 98 + 신규 2)
3. 수동 QA 9:
   - spin → 결과 세그먼트 12시 포인터 정확 정렬
   - 진행 중 새로고침 → activeRound 복원, 잔액 변화 0, 동일 nonce/결과
   - PF 시드 변경 → nonce 0 + activeRound + lastOutcome 클리어 + 토스트
   - 키보드 Space/←→/1/2/3/P/M
   - reduced-motion ON → 회전 즉시 + pulse OFF
   - high risk jackpot (mult ≥ 9.0) → `RewardBurst` + `jackpot` SFX **+ win/lose toast 미출현**
   - 일반 win/loss → 토스트 0건
   - idle 휠 → 각 세그먼트 배수 라벨 + 0× vignette + active risk 색 펄스
   - settle → 결과 세그먼트 glow trail 0.6s fade
4. 회귀: Dice/Crash/Mines/Plinko/Limbo/Lobby 0건
5. `supabase/` · `styles.css` 변경 0건
6. GitHub push

---

## 11) Cursor pull audit 체크리스트
- `WheelEngine.ts` diff = 0
- Dice/Crash/Mines/Plinko/Limbo/Lobby Screen diff = 0
- `bettingRoundKey={activeRound?.nonce ?? nonce}` 존재
- **place 성공 시 `nonce++` / idle nonce++ effect 삭제됨**
- HistoryPillStrip 매핑 `{ id, multiplier: h.multiplier }`
- `recordSessionOutcome` **no `game` field**
- `WHEEL_RULES` 기존 6 섹션 보존 + 「단축키」 1 섹션 append
- localStorage key `phonara.gamestate.wheel.v1` 유지
- `wheelStore.restore.spec` — `tryDebit` mock **0 calls**
- `styles.css` diff = 0 (segment-pulse keyframe 없음 → `animate-phon-pulse` 재사용)
- raw tailwind palette (`cyan-400`/`slate-800`/`text-black` 등) grep → 0 hit
- `appToast.game.win|lose` Wheel 내 호출 0건

---

## 파일 요약

**Modified (3)**
- `src/features/games/wheel/WheelScreen.tsx` (468 → ~230)
- `src/shared/games/state/persistedGameState.ts` (WheelPersisted 확장, v1 유지)
- `src/shared/games/rules/gameRules.ts` (WHEEL_RULES 「단축키」 append)

**Created (4)**
- `src/features/games/wheel/WheelDisplay.tsx`
- `src/features/games/wheel/WheelControls.tsx`
- `src/shared/games/state/__tests__/wheelStore.persist.spec.ts`
- `src/shared/games/state/__tests__/wheelStore.restore.spec.ts`

## 비대상 (Cursor 후속)
- `@keyframes segment-pulse` 신설 (styles.css)
- 멀티슬롯 · 3D WebGL · PF Edge Function · 진짜 돈 정산·VIP·rakeback · E2E selector

## 다음 라운드
ROUND K — 사용자 지정 대기

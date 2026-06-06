# ROUND P-PR2 — Feed UI polish + RightRail dock (Lovable)

SSOT: `docs/backlog/rounds/GAMES-ROADMAP-v2.2-v2.3.md § P` (Lovable PR2 영역)
선행: Cursor ROUND O sanitation GREEN (`761c27f`)
병렬: Cursor PR1 (Supabase Realtime + `lib/api/liveFeed.ts` + Store adapter) — UI-only 선행 가능

---

## Red Lines (0-diff)

- `supabase/`, `src/integrations/supabase/`
- `src/lib/api/**` 전체
- `src/shared/livefeed/LiveBetsStore.ts` 코어 시그니처 + 내부 상태
- `src/shared/livefeed/botGenerator.ts`
- `orderLiveBetsForView`, `LiveBet` 타입
- `useTilt`, `useHotkeys`, `useRegisterRightRail`, `useDesktopLayout` API
- `walletStore`, game Engine/persist store
- `LiveBetsFeed` 기존 props default 동작 0-diff
- `WheelRightRail.tsx` 0-diff (`limit={10}` 유지)
- 신규 npm dep = 0

---

## Scope

### 1) Desktop RightRail dock — 5종 (최우선)

SSOT: WheelScreen 패턴 (`useDesktopLayout()` + `useRegisterRightRail(node)`).
**desktop 분기 = `useDesktopLayout()` only** (useGameViewport는 px 측정용이라 미사용).

신규 파일 (각 ≤ 60줄, feed-only — SessionStatsBar 미포함):

- `src/features/games/crash/CrashRightRail.tsx`
- `src/features/games/dice/DiceRightRail.tsx`
- `src/features/games/mines/MinesRightRail.tsx`
- `src/features/games/limbo/LimboRightRail.tsx`
- `src/features/games/plinko/PlinkoRightRail.tsx`

각 파일: `memo` + `<LiveBetsFeed game="<id>" limit={80} virtualized showHeader />` 단일 카드.

각 Screen 수정 (5개): `useMemo` + `useRegisterRightRail(node)`. 본문 inline `<LiveBetsFeed game=…>`가 있으면 `useDesktopLayout()` true일 때만 숨김. 모바일 0-diff.

### 2) LiveBetsFeed — 필터 칩 (메모리 state, **game prop 없을 때만 렌더**)

`LiveBetsFeed.tsx` 헤더 아래 chip row:

- `All` / `Big wins` / `Me only` — `SegmentedTabs` + compact override (`className="py-1.5 text-[10px]"`)
- `useState`만, URL state 없음
- **game prop 존재 시 칩 자체 렌더 X** → 게임 dock/inline에는 영향 0
- 칩이 실제 보이는 곳: `FeedRightRail`의 `<LiveBetsFeed limit={10}/>` 등 global feed

**Derive 정의 (고정):**

```ts
// orderLiveBetsForView 결과 위에 소비 측 derive
All:      view
Big wins: view.filter(b =>
            (b.status === "win" || b.status === "cashout") &&
            b.multiplier != null && b.multiplier >= 10)
Me only:  view.filter(b => b.isMe === true)
```

라인 예산: `LiveBetsFeed.tsx` ≤ 200

### 3) LiveBetRow — ME row 시각 강화

`LiveBetRow.tsx`만 수정 — **ROW_GRID 컬럼 변경 금지**:

- ME 행: `absolute left-0 inset-y-0 w-[2px]` cyan glow bar (grid 외부)
- 승리 ME 행 (status win/cashout): emerald pulse ring 1회, reduced-motion ON 시 정적
- row 컨테이너 `relative` 추가 외 grid·height 0-diff (ROW_HEIGHT=32 유지)
- 클릭 핸들러 신규 X

라인 예산: `LiveBetRow.tsx` ≤ 120

---

## Acceptance Criteria

- **AC-P2-1** 5개 신규 `*RightRail.tsx` 존재, 각 ≤ 60줄, feed-only (StatsBar 미포함)
- **AC-P2-2** Crash/Dice/Mines/Limbo/Plinko Screen 각 `useRegisterRightRail` 1회 호출 (`rg useRegisterRightRail src/features/games --glob "*Screen*"` = 5 + wheel)
- **AC-P2-3** desktop(`useDesktopLayout()=true`) 진입 시 5종 모두 우측 dock 노출, 모바일 0-diff
- **AC-P2-4** `LiveBetsFeed`에 `game` prop 없을 때만 칩 렌더, 3 필터 동작 (Big wins=multiplier≥10, Me only=isMe)
- **AC-P2-5** 기존 호출부 (FeedRightRail/Wheel/inline) 0 regression — WheelRightRail `limit={10}` 0-diff
- **AC-P2-6** ME 행 absolute glow bar (ROW_GRID/ROW_HEIGHT=32 0-diff), virtual list 정렬 유지, 승리 시 pulse 1회, reduced-motion ON → 정적
- **AC-P2-7** `LiveBetsStore.ts`, `botGenerator.ts`, `lib/api/**`, `supabase/**`, `WheelRightRail.tsx` git diff = 0
- **AC-P2-8** `bun run lint:strict` 0 warnings
- **AC-P2-9** `bun run check` 148+ GREEN (CrashRightRail mount smoke + 필터 칩 derive 단위 테스트 추가)
- **AC-P2-10** `wc -l LiveBetsFeed.tsx` ≤ 200, `LiveBetRow.tsx` ≤ 120
- **AC-P2-11** `package.json` / `bun.lock` diff = 0

---

## Non-goal

- Big win toast/marquee (LiveCashoutStrip 별도)
- ME 클릭 → 본인 베팅 모달 (v2.3)
- RightRail collapse/expand
- Supabase Realtime, `lib/api/liveFeed.ts`, Store adapter → Cursor PR1

---

## Exit Gate

```text
1. bun run lint:strict          # 0 warnings
2. bun run check                # 148+ GREEN
3. git diff src/shared/livefeed/LiveBetsStore.ts      # 0
4. git diff src/shared/livefeed/botGenerator.ts       # 0
5. git diff src/features/games/wheel/WheelRightRail.tsx  # 0
6. git diff src/lib/api/ supabase/                    # 0
7. git diff package.json bun.lock                     # 0
8. 수동 QA desktop (≥1024):
   a. Crash/Dice/Mines/Limbo/Plinko 우측 dock 노출
   b. 필터 칩 → /feed (FeedRightRail global feed, game prop 없음)에서
      All / Big wins(×10+) / Me only 토글
   c. ME 베팅 행 좌측 cyan bar + 승리 시 pulse 1회
9. 수동 QA mobile (<1024): dock 미렌더, 본문 0-diff
```

---

## Post-P2 queue

```text
[지금]   Lovable → ROUND P-PR2 (UI polish + dock)   ← 본 plan
[병렬]   Cursor  → P-PR1 (Supabase Realtime + adapter)
[다음]   Cursor  → P-PR2 sanitation grep
[그다음] Cursor  → Q-PR1 (/fair/verify + SHA256) or Lovable Q polish
```

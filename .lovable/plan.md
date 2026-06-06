# ROUND O — Lobby & Live Feed (Lovable)

SSOT: `docs/backlog/rounds/GAMES-ROADMAP-v2.1.md § ROUND O`
선행: ROUND N 완료 (Cursor sanitation GREEN, `8dd2ec6`)

---

## Red Lines (0-diff)

- **미접촉:** `supabase/`, `src/integrations/supabase/`, `src/lib/api/`, `walletStore` 스키마
- **시그니처 보존:** `LiveBetsStore` API (`subscribe`/`getSnapshot`/`push`/`settle`/`ensureUserPending`/`update`/`__reset`), `orderLiveBetsForView`, `LiveBet` 타입
- `GAME_REGISTRY` 스키마 0-diff (필드 추가/제거 금지 — 표시 derive only)
- `gameRules.ts`, 게임 Engine·Screen·persist store 0-diff
- 기존 `LiveBetsFeed` props 계약 (`limit`/`showHeader`/`game`/`className`) 보존
- 신규 npm dep는 **`react-window` + `@types/react-window` 1쌍만** (로드맵 명시)

---

## Scope

### 신규 파일

- `src/features/games/GameCard3D.tsx` (~110줄)
  - `useTilt` 적용 (reduced-motion off, SSR 가드 — 기존 훅 재사용)
  - Game accent glow, status badge (LIVE/SOON), hover sparkline placeholder
  - `Link to={gamePath(card.id)}` 래핑 (기존 GameTile 로직 대체)
- `src/features/games/GameMiniStats.tsx` (~70줄)
  - 메모리 derive sparkline (recent 30 bets `liveBetsStore` filter by game)
  - SVG polyline, no persistence
- `src/shared/livefeed/LiveBetsVirtualList.tsx` (~120줄)
  - `react-window` `FixedSizeList` wrap
  - row height 고정 (28px), 500행 한계
  - `LiveBetRow` JSX는 `LiveBetsFeed` 내부에서 export하여 재사용
- 테스트: `src/features/games/__tests__/GameCard3D.spec.tsx`, `src/shared/livefeed/__tests__/LiveBetsVirtualList.spec.tsx`

### 수정 파일

- `src/features/games/GameLobby.tsx` (75 → ~90)
  - 그리드 → `GameCard3D` 매핑
  - hotkeys ↑↓ (focus 이동, Enter로 navigate) — `useHotkeys`
- `src/shared/livefeed/LiveBetsFeed.tsx` (186 → ~140)
  - `limit > 50` 이거나 명시 prop `virtualized` 시 `LiveBetsVirtualList` 사용
  - `LiveBetRow` export (또는 동일 파일 내 분리 후 가상 리스트 import)
  - 기존 호출부 0-diff (defaults: virtualized=false)

### 의존성

```bash
bun add react-window @types/react-window
```

---

## Acceptance Criteria

- **AC-O-1** `bun add react-window @types/react-window` 정확히 1회, `package.json` diff = 2 deps
- **AC-O-2** `GameCard3D.tsx`, `GameMiniStats.tsx`, `LiveBetsVirtualList.tsx` 파일 존재
- **AC-O-3** `GameLobby.tsx` 본문에서 카드 JSX 인라인 제거 → `GameCard3D` 위임
- **AC-O-4** Lobby 키보드 ↑↓ focus 이동, Enter navigate (input focus 시 비활성)
- **AC-O-5** `LiveBetsFeed` 기존 호출부 (Feed/RightRail/Crash/etc) 0 regression — defaults 동일 렌더
- **AC-O-6** `LiveBetsVirtualList` 500행 mount 후 scroll 60fps (수동 QA, DOM 노드 ≤ viewport 행 수)
- **AC-O-7** reduced-motion ON → tilt off, sparkline 정적
- **AC-O-8** SSR 가드: `react-window` import는 컴포넌트 본문 (top-level OK, but window 참조 X)
- **AC-O-9** `useTilt` 0-diff (재사용만)
- **AC-O-10** `LiveBetsStore` API 0-diff
- **AC-O-11** `bun run lint:strict` 0 warnings, `bun run check` 145+ GREEN
- **AC-O-12** `wc -l src/features/games/GameLobby.tsx` ≤ 120
- **AC-O-13** ME 행 pinning (`orderLiveBetsForView`) 가상 리스트에서도 유지

---

## Exit Gate

```text
1. bun run lint:strict      # 0 warnings
2. bun run check            # 145+ GREEN + build success
3. wc -l GameLobby.tsx ≤ 120
4. 수동 QA:
   a. Lobby 카드 hover tilt, click navigate
   b. ↑↓ Enter 키보드 nav
   c. LiveBetsFeed 기존 위치 (FeedScreen / RightRail / 게임 Screen) 0 regression
   d. LiveBetsVirtualList 500행 scroll smooth, ME pinned
   e. reduced-motion ON → 정적
5. SSR 가드 (`navigator`/`window` 직접 참조 X)
```

---

## Cursor sanitation grep points (post-O merge)

```bash
wc -l src/features/games/GameLobby.tsx                  # ≤ 120
ls src/features/games/GameCard3D.tsx                    # exists
ls src/features/games/GameMiniStats.tsx                 # exists
ls src/shared/livefeed/LiveBetsVirtualList.tsx          # exists
rg "react-window" package.json                          # 2 lines (dep + types)
rg "LiveBetsStore" src/shared/livefeed/LiveBetsStore.ts # API 0-diff
```

---

## Non-goal (v2.2+)

- Realtime feed (Supabase channel) → Cursor ROUND P
- 진짜 sparkline 데이터 source (현재는 메모리 derive)
- Lobby 필터/검색 UI (cards만 가상화 X — 8개 이내)
- Game card cover image / artwork

---

## Post-O queue

```text
[지금]   Lovable → ROUND O (Lobby + react-window)   ← 본 plan
[다음]   Cursor  → O sanitation + grep
[그다음] Lovable → 폴리시 라운드 또는 v2.2 진입 결정
[병렬]   Cursor  → ROUND P (Realtime feed, v2.2)
```

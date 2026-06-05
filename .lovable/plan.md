# LAYOUT-L — Wheel 데스크탑 3열 파일럿 (v1.1)

P-0 (origin/main @ b1a36d0)이 머지됐으므로 Wheel만 ≥1024px에서 3열 (Sidebar | Center | RightRail)로 동작하게 합니다. 모바일(<1024px) 0 diff. 엔진/스토어/스타일/4개 게임 미접촉.

Cursor 피드백 반영:
1. **SessionStatsBar 중복 가드** — historyStrip 안에서도 `!isDesktop` 분기.
2. **useRegisterRightRail 단순화** — 내부에서 이미 1024 분기하므로 isDesktop 삼항 제거.

## 변경 파일 (총 2)

### 1. 신규 `src/features/games/wheel/WheelRightRail.tsx`
- `SessionStatsBar` + `LiveBetsFeed game="wheel" limit={10} showHeader`을 세로 스택
- 순수 표현 컴포넌트 (memo), props 없음

### 2. 수정 `src/features/games/wheel/WheelScreen.tsx`
- import 추가:
  - `useDesktopLayout` from `@/shared/hooks/useDesktopLayout`
  - `useRegisterRightRail` from `@/shared/layout/useGameLayout`
  - `WheelRightRail` (local)
- 컴포넌트 body:
  ```ts
  const isDesktop = useDesktopLayout();
  const rightRail = useMemo(() => <WheelRightRail />, []);
  useRegisterRightRail(rightRail); // 내부에서 1024 분기 처리
  ```
- **historyStrip 안 `SessionStatsBar`을 모바일 전용으로**:
  ```tsx
  historyStrip={
    <div className="flex flex-col gap-1.5">
      <HistoryPillStrip ... />
      {!isDesktop && <SessionStatsBar />}
    </div>
  }
  ```
- **하단 `<LiveBetsFeed>`을 모바일 전용으로**:
  ```tsx
  {!isDesktop && <LiveBetsFeed game="wheel" limit={10} />}
  ```

다른 로직/JSX/import 0 diff.

## 절대 미접촉
`WheelEngine.ts`, `WheelDisplay.tsx`, `WheelControls.tsx`, `WheelLegend.tsx`, `wheelStore` (persistedGameState), `styles.css`, `GameShell`, `StakeBetPanel`, 나머지 5게임 (Dice/Crash/Mines/Plinko/Limbo/Lobby), `supabase/`, `src/integrations/supabase/types.ts`, `src/lib/api/`, P-0 파일들 (`useDesktopLayout`, `DesktopShell`, `RightRail`, `useGameLayout`, `AppSidebar`).

## 동작

```text
<1024px (모바일)
  center: GameShell (max-w-md, historyStrip=PillStrip+SessionStatsBar)
        + LiveBetsFeed 하단
  RightRail: null

≥1024px (데스크탑)
  AppSidebar | Center(max-w-4xl, GameShell, historyStrip=PillStrip only)
            | RightRail(SessionStatsBar + LiveBetsFeed)
  → SessionStatsBar 1개, LiveBetsFeed 1개
```

## QA 체크리스트

| 항목 | 기대 |
|---|---|
| <1024 Wheel | 모바일 0 diff (SessionStatsBar 1·LiveBets 1) |
| ≥1024 Wheel | sidebar + center(max-w-4xl) + RightRail |
| ≥1024 Wheel DOM `LiveBetsFeed` | 정확히 1 (RightRail) |
| ≥1024 Wheel DOM `SessionStatsBar` | 정확히 1 (RightRail) |
| ≥1024 다른 게임 (Dice/Crash 등) | RightRail 미렌더 |
| ≥1024 비-게임 (Earn/Feed) | RightRail 미렌더 |
| 1023↔1024 리사이즈 | RightRail 토글, wheelStore 상태 보존 |
| 125% OS zoom | P-0 SSOT 그대로 |
| `bun run lint:strict` | GREEN |
| `bun run check` | GREEN (109 tests 0 변동) |

## 다음 라운드 (범위 외)
- P-3에서 이 패턴을 K~O 5게임에 일괄 복제 (Cursor canvas 게임 서브태스크 선행).

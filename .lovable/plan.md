# P-1 Phase 2 — Feed desktop RightRail (ONLY)

Phase 1 인프라(`useRegisterMainMode`, DesktopShell mode 분기, 6게임 `game` 등록) main merge 확인됨. Wheel/LAYOUT-L 0-diff.

## 변경 (`src/features/feed/`만)

### 1. `src/features/feed/FeedRightRail.tsx` (신규) — `useRegisterRightRail` 유일 호출
```tsx
import { useMemo } from "react";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { useRegisterRightRail } from "@/shared/layout/useGameLayout";

export function FeedRightRail() {
  const node = useMemo(
    () => (
      <>
        <LiveCashoutStrip />
        <LiveBetsFeed limit={10} />
      </>
    ),
    [],
  );
  useRegisterRightRail(node);
  return null;
}
```
- `useRegisterRightRail` 내부에서 `useDesktopLayout` 분기 처리 → 모바일은 자동 미등록.
- v1은 기존 컴포넌트 재배치만 (신규 디자인 비범위).

### 2. `src/features/feed/FeedScreen.tsx`
- `useRegisterMainMode('feed')` 호출 (DesktopShell `<main>` → `lg:max-w-2xl` ≈672px).
- `const isDesktop = useDesktopLayout()`.
- Center 내 `<LiveCashoutStrip />` / `<LiveBetsFeed limit={10} />` → `{!isDesktop && ...}` 로 감싸 **DOM singleton** 보장 (CSS `hidden lg:` 토글 금지).
- `<FeedRightRail />` 마운트 (Screen에서 `useRegisterRightRail` 호출 금지).
- 헤더 / `ModeToggle` / `NoticeBar` / `EventHero` / `FomoMarquee` / Hot strip / 실시간 스트림 / compact `OnlineCounterChip` 0-diff.

## 0-diff 보호
`DesktopShell`, `ResponsiveShell`, `GameLayoutProvider`, `gameLayoutContext`, `useGameLayout`, `RightRail` 컨테이너, `MobileShell`, `BottomNav`, `AppSidebar`, 6게임 Screen 및 엔진/내부 컴포넌트(특히 `WheelScreen`, `WheelRightRail`), `src/styles.css`, `supabase/`, `src/lib/api/`, `src/integrations/supabase/types.ts`, 랜딩/온보딩/로그인, `/deposit`/`/withdrawal`.

## QA
- ≥1024 `/feed`: Center ≈672px, RightRail 320px에 `LiveCashoutStrip` + `LiveBetsFeed(limit=10)`, **각 위젯 DOM 1 인스턴스**.
- ≥1024 `/` (Landing) / `/money` / `/earn` / `/notifications` / `/my`: 기본 `mobile` mode ≈448px, 0-diff.
- ≥1024 6게임: `game` mode ≈896px, 0-diff (Wheel RightRail 포함).
- <1024 모든 라우트: 0-diff.
- `bun run check` GREEN.

## Cursor audit-only (Lovable 완료 후)
- `src/features/feed/` diff만
- DOM singleton (LiveCashoutStrip / LiveBetsFeed) 확인
- `bun run check`

## 비범위 (후속)
- RightRail 위젯 세로형 신규 디자인
- 나머지 5게임 RightRail 이전
- Feed 카드 데스크탑 그리드

/**
 * FeedRightRail — P-1 Phase 2 데스크탑(≥1024) 우측 패널.
 * LiveCashoutStrip + LiveBetsFeed를 세로 스택으로 RightRail에 등록.
 *
 * 설계 결정 (LAYOUT-L / FINAL v2 lock):
 *  - `useRegisterRightRail` 호출은 본 컴포넌트 **단일 지점**. FeedScreen에서 중복 호출 금지.
 *  - `useRegisterRightRail` 내부에서 `useDesktopLayout` 분기 → 모바일 자동 미등록.
 *  - v1은 기존 컴포넌트 재배치만 (세로형 신규 디자인은 v2 비범위).
 *  - return null — 표현 위임, DOM 트리에는 RightRail 컨테이너에서만 마운트.
 */
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

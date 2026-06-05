/**
 * WheelRightRail — LAYOUT-L 데스크탑(≥1024) 우측 패널.
 * SessionStatsBar + LiveBetsFeed(wheel)을 세로 스택.
 * 모바일은 미렌더 (useRegisterRightRail 내부에서 1024 분기).
 */
import { memo } from "react";
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";

export const WheelRightRail = memo(function WheelRightRail() {
  return (
    <div className="flex flex-col gap-3">
      <SessionStatsBar />
      <LiveBetsFeed game="wheel" limit={10} showHeader />
    </div>
  );
});

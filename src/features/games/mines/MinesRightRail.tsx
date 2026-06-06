/**
 * MinesRightRail — desktop(≥1024) right dock for Mines. Feed-only.
 */
import { memo } from "react";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";

export const MinesRightRail = memo(function MinesRightRail() {
  return (
    <div className="flex flex-col gap-3">
      <LiveBetsFeed game="mines" limit={80} virtualized showHeader />
    </div>
  );
});

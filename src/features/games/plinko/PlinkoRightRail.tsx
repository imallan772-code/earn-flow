/**
 * PlinkoRightRail — desktop(≥1024) right dock for Plinko. Feed-only.
 */
import { memo } from "react";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";

export const PlinkoRightRail = memo(function PlinkoRightRail() {
  return (
    <div className="flex flex-col gap-3">
      <LiveBetsFeed game="plinko" limit={80} virtualized showHeader />
    </div>
  );
});

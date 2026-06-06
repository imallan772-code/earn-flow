/**
 * LimboRightRail — desktop(≥1024) right dock for Limbo. Feed-only.
 */
import { memo } from "react";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";

export const LimboRightRail = memo(function LimboRightRail() {
  return (
    <div className="flex flex-col gap-3">
      <LiveBetsFeed game="limbo" limit={80} virtualized showHeader />
    </div>
  );
});

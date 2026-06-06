/**
 * DiceRightRail — desktop(≥1024) right dock for Dice. Feed-only.
 */
import { memo } from "react";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";

export const DiceRightRail = memo(function DiceRightRail() {
  return (
    <div className="flex flex-col gap-3">
      <LiveBetsFeed game="dice" limit={80} virtualized showHeader />
    </div>
  );
});

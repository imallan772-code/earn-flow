/**
 * CrashRightRail — desktop(≥1024) right dock for Crash. Feed-only.
 * Mobile not rendered (useRegisterRightRail handles 1024 branch).
 */
import { memo } from "react";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";

export const CrashRightRail = memo(function CrashRightRail() {
  return (
    <div className="flex flex-col gap-3">
      <LiveBetsFeed game="crash" limit={80} virtualized showHeader />
    </div>
  );
});

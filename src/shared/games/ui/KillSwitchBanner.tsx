import { AlertTriangle, ShieldOff } from "lucide-react";
import { useKillSwitch } from "@/shared/games/hooks/useKillSwitch";

/**
 * GA-M: Global system-status banner.
 * L2 — maintenance mode, new bets blocked, active rounds resume normally.
 * L3 — full stop, all game activity blocked.
 */
export function KillSwitchBanner() {
  const { level, loading } = useKillSwitch();

  if (loading || level === "L0") return null;

  if (level === "L3") {
    return (
      <div
        role="alert"
        className="w-full bg-red-900/95 text-red-100 flex items-center gap-3 px-4 py-3 text-sm font-medium"
      >
        <ShieldOff className="shrink-0 h-4 w-4 text-red-300" />
        <span>
          시스템 점검 중 — 모든 게임이 일시 중단되었습니다. 출금은 정상 처리됩니다.
        </span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="w-full bg-amber-900/95 text-amber-100 flex items-center gap-3 px-4 py-3 text-sm font-medium"
    >
      <AlertTriangle className="shrink-0 h-4 w-4 text-amber-300" />
      <span>
        시스템 점검 중 — 신규 베팅이 일시 중단되었습니다. 진행 중인 라운드는 정상 정산됩니다.
      </span>
    </div>
  );
}

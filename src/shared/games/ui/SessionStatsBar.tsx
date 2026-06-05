import { memo } from "react";
import { cn } from "@/lib/utils";
import { useSessionStats } from "./sessionStats";

export const SessionStatsBar = memo(function SessionStatsBar() {
  const stats = useSessionStats();

  return (
    <div className="glass-1 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[10px]">
      <Stat label="세션 P/L" value={stats.pnl} signed />
      <Stat label="최고 배수" value={stats.bestMultiplier} suffix="x" />
      <Stat label="연승" value={stats.winStreak} />
      <Stat label="연패" value={stats.lossStreak} />
    </div>
  );
});

function Stat({
  label,
  value,
  signed,
  suffix,
}: {
  label: string;
  value: number;
  signed?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-muted-2">{label}</span>
      <span
        className={cn(
          "font-numeric font-bold",
          signed && value > 0 && "text-emerald",
          signed && value < 0 && "text-(--color-rose)",
        )}
      >
        {signed && value > 0 ? "+" : ""}
        {value.toFixed(suffix ? 2 : 0)}
        {suffix ?? ""}
      </span>
    </div>
  );
}

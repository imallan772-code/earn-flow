/**
 * WheelLegend — 색별 배당 범례 (ROUND K v1).
 *
 * 정책
 *  - 휠 디스플레이가 risk마다 단색을 사용하므로(0×는 muted, 그 외는 riskColor),
 *    범례도 동일 매핑으로 "color = active/inactive + risk band"를 한눈에 보여줌.
 *  - 칩 = glass-2 + 색 도트 + "{mult}× ×{count}".
 *  - WheelEngine 0 diff: `getSegments` 만 import.
 *  - styles.css 0 diff. raw tailwind palette 금지.
 */
import { memo, useMemo } from "react";
import { getSegments, type WheelRisk, type WheelSegments } from "@/shared/games/wheel/WheelEngine";

interface Props {
  risk: WheelRisk;
  segments: WheelSegments;
}

function riskColor(risk: WheelRisk): string {
  if (risk === "low") return "var(--color-cyan)";
  if (risk === "medium") return "var(--color-gold)";
  return "var(--color-rose)";
}

interface LegendItem {
  mult: number;
  count: number;
  color: string;
}

export const WheelLegend = memo(function WheelLegend({ risk, segments }: Props) {
  const items = useMemo<LegendItem[]>(() => {
    const arr = getSegments(risk, segments);
    const counts = new Map<number, number>();
    for (const m of arr) counts.set(m, (counts.get(m) ?? 0) + 1);
    const active = riskColor(risk);
    const sorted = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
    return sorted.map(([mult, count]) => ({
      mult,
      count,
      color: mult === 0 ? "var(--color-muted)" : active,
    }));
  }, [risk, segments]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="배당 범례">
      {items.map((it) => (
        <div key={it.mult} className="glass-2 flex items-center gap-1.5 rounded-full px-2.5 py-1">
          <span
            aria-hidden
            className="inline-block size-2 rounded-full"
            style={{
              background: it.color,
              boxShadow:
                it.mult === 0
                  ? undefined
                  : `0 0 6px color-mix(in oklab, ${it.color} 60%, transparent)`,
            }}
          />
          <span className="font-numeric text-[11px] font-bold tabular-nums text-(--color-foreground)">
            {it.mult}×
          </span>
          <span className="text-[10px] font-medium text-(--color-muted)">×{it.count}</span>
        </div>
      ))}
    </div>
  );
});

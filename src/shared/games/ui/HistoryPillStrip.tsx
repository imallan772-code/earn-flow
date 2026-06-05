import { memo } from "react";
import { cn } from "@/lib/utils";

export interface HistoryPillItem {
  id: string;
  multiplier: number;
}

interface Props {
  items: HistoryPillItem[];
  onPillClick?: (item: HistoryPillItem) => void;
  className?: string;
}

function tierClass(mult: number): string {
  if (mult >= 100) return "mult-tier-rose";
  if (mult >= 10) return "mult-tier-gold";
  if (mult >= 2) return "mult-tier-cyan";
  return "mult-tier-muted";
}

export const HistoryPillStrip = memo(function HistoryPillStrip({
  items,
  onPillClick,
  className,
}: Props) {
  return (
    <ul className={cn("-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none", className)}>
      {items.map((h) => (
        <li key={h.id}>
          <button
            type="button"
            onClick={() => onPillClick?.(h)}
            className={cn(
              "font-numeric shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition active:scale-95",
              tierClass(h.multiplier),
            )}
          >
            {h.multiplier.toFixed(2)}x
          </button>
        </li>
      ))}
    </ul>
  );
});

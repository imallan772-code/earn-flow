import { memo } from "react";
import { cn } from "@/lib/utils";

export interface HistoryPillItem {
  id: string;
  /** multiplier 모드: 배수 (예: 2.34 → "2.34x"). value 모드: 자유 값 (예: dice roll 73.42 → "73.42") */
  multiplier: number;
  /** value 모드에서 win/loss 색상 티어 결정 (multiplier 모드에서는 무시) */
  won?: boolean;
}

interface Props {
  items: HistoryPillItem[];
  onPillClick?: (item: HistoryPillItem) => void;
  className?: string;
  /**
   * 표시 모드:
   *  - "multiplier" (default): `X.XXx` + 배수 기반 색상 티어 (Crash/Wheel/Limbo)
   *  - "value": 접미사 없음, won 기반 색상 (Dice roll 등 — 값 자체는 배수가 아님)
   */
  displayMode?: "multiplier" | "value";
}

function multiplierTierClass(mult: number): string {
  if (mult >= 100) return "mult-tier-rose";
  if (mult >= 10) return "mult-tier-gold";
  if (mult >= 2) return "mult-tier-cyan";
  return "mult-tier-muted";
}

function valueTierClass(won: boolean | undefined): string {
  return won ? "mult-tier-cyan" : "mult-tier-muted";
}

export const HistoryPillStrip = memo(function HistoryPillStrip({
  items,
  onPillClick,
  className,
  displayMode = "multiplier",
}: Props) {
  return (
    <ul className={cn("-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none", className)}>
      {items.map((h) => {
        const isValueMode = displayMode === "value";
        const tier = isValueMode ? valueTierClass(h.won) : multiplierTierClass(h.multiplier);
        const label = isValueMode ? h.multiplier.toFixed(2) : `${h.multiplier.toFixed(2)}x`;
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onPillClick?.(h)}
              className={cn(
                "font-numeric shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition active:scale-95",
                tier,
              )}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
});

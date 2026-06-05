/**
 * LimboTargetStepper — target multiplier stepper.
 * Chips + ±0.1 / ±1.0 / ÷2 / 2× / direct input.
 * Operates on the store target (active slot's next bet).
 */
import { memo } from "react";
import { MAX_TARGET, MIN_TARGET, clampTarget } from "@/shared/games/limbo/LimboEngine";
import { cn } from "@/lib/utils";

const CHIPS = [1.5, 2, 5, 10, 100] as const;

interface Props {
  target: number;
  disabled: boolean;
  onChange: (next: number) => void;
}

export const LimboTargetStepper = memo(function LimboTargetStepper({
  target,
  disabled,
  onChange,
}: Props) {
  const set = (n: number) => onChange(clampTarget(n));
  return (
    <div className="glass-2 flex flex-col gap-2 rounded-2xl p-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
          목표 배수
        </span>
        <button
          type="button"
          onClick={() => set(target / 2)}
          disabled={disabled}
          className="rounded-lg bg-(--color-surface-hi) px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40"
        >
          ÷2
        </button>
        <button
          type="button"
          onClick={() => set(target - 0.1)}
          disabled={disabled}
          className="rounded-lg bg-(--color-surface-hi) px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40"
        >
          −0.1
        </button>
        <input
          type="number"
          min={MIN_TARGET}
          max={MAX_TARGET}
          step={0.01}
          value={target}
          disabled={disabled}
          onChange={(e) => set(Number(e.target.value) || MIN_TARGET)}
          className="font-numeric flex-1 rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-center text-sm font-extrabold text-gold outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => set(target + 0.1)}
          disabled={disabled}
          className="rounded-lg bg-(--color-surface-hi) px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40"
        >
          +0.1
        </button>
        <button
          type="button"
          onClick={() => set(target * 2)}
          disabled={disabled}
          className="rounded-lg bg-(--color-surface-hi) px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40"
        >
          2×
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => set(c)}
            disabled={disabled}
            className={cn(
              "font-numeric shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition",
              Math.abs(target - c) < 0.001
                ? "bg-warning text-(--color-bg-0) shadow-glow-gold ring-2 ring-gold"
                : "bg-(--color-surface-hi) text-(--color-muted) hover:bg-bg-2",
              disabled && "opacity-50",
            )}
          >
            {c}x
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-2">
        Space 베팅 · ↑↓ ±0.1 · Shift+↑↓ ±1.0 · 1/2 슬롯 · P 공정성 · M 음소거
      </p>
    </div>
  );
});

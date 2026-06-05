/**
 * DiceSlider — interactive target picker with Over/Under mode toggle.
 *
 * Pure UI. Owner controls `target` + `mode`.
 * ROUND K: 햅틱(navigator.vibrate, SSR 가드) + onTick/onModeTick SFX 콜백.
 */
import { type DiceMode, MAX_ROLL, payoutMultiplier, winChance } from "./DiceEngine";
import { cn } from "@/lib/utils";

interface Props {
  target: number;
  mode: DiceMode;
  onTargetChange: (t: number) => void;
  onModeChange: (m: DiceMode) => void;
  /** Last roll to draw a marker on the bar (optional). */
  lastRoll?: number | null;
  /** SFX/햅틱 트리거 (Screen에서 주입). target 변경 시. */
  onTargetTick?: () => void;
  /** SFX/햅틱 트리거. mode 변경 시. */
  onModeTick?: () => void;
}

function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* noop */
    }
  }
}

export function DiceSlider({
  target,
  mode,
  onTargetChange,
  onModeChange,
  lastRoll,
  onTargetTick,
  onModeTick,
}: Props) {
  const wc = winChance(target, mode);
  const pm = payoutMultiplier(wc);
  const winPct = (target / MAX_ROLL) * 100;

  const winColor = "var(--color-emerald)";
  const loseColor = "var(--color-rose)";
  const bg =
    mode === "under"
      ? `linear-gradient(to right, ${winColor} 0%, ${winColor} ${winPct}%, ${loseColor} ${winPct}%, ${loseColor} 100%)`
      : `linear-gradient(to right, ${loseColor} 0%, ${loseColor} ${winPct}%, ${winColor} ${winPct}%, ${winColor} 100%)`;

  const lastPct = lastRoll != null ? Math.min(100, Math.max(0, (lastRoll / MAX_ROLL) * 100)) : null;

  const handleTarget = (next: number) => {
    if (next === target) return;
    vibrate(8);
    onTargetTick?.();
    onTargetChange(next);
  };

  const handleMode = (m: DiceMode) => {
    if (m === mode) return;
    vibrate(12);
    onModeTick?.();
    onModeChange(m);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* mode toggle */}
      <div className="glass-1 grid grid-cols-2 rounded-xl p-1">
        {(["under", "over"] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleMode(m)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
              mode === m
                ? "bg-(--color-cyan) text-(--color-bg-0) shadow-glow-cyan"
                : "text-(--color-muted)",
            )}
          >
            {m === "under" ? "낮게 (Under)" : "높게 (Over)"}
          </button>
        ))}
      </div>

      {/* bar + slider stacked */}
      <div className="relative">
        <div
          className="relative h-4 w-full overflow-visible rounded-full"
          style={{ background: bg, opacity: 0.92 }}
        >
          {/* axis ticks (0, 25, 50, 75, 99.99) */}
          {[0, 25, 50, 75, 100].map((p) => (
            <span
              key={p}
              className="absolute top-full mt-2 -translate-x-1/2 text-[9px] font-bold text-muted-2 font-numeric"
              style={{ left: `${p}%` }}
            >
              {p === 100 ? "99.99" : ((p * MAX_ROLL) / 100).toFixed(0)}
            </span>
          ))}
          {lastPct != null && (
            <div
              key={lastPct}
              className="animate-result-pop absolute top-1/2 h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--color-foreground) shadow-[0_0_10px_var(--color-foreground)]"
              style={{ left: `${lastPct}%` }}
              aria-hidden
            />
          )}
        </div>

        <input
          type="range"
          min={1}
          max={Math.floor(MAX_ROLL) - 1}
          step={1}
          value={Math.round(target)}
          onChange={(e) => handleTarget(Number(e.target.value))}
          className="-mt-4 h-4 w-full cursor-pointer appearance-none bg-transparent
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-7
                     [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-(--color-foreground)
                     [&::-webkit-slider-thumb]:shadow-glow-cyan
                     [&::-webkit-slider-thumb]:border-2
                     [&::-webkit-slider-thumb]:border-(--color-cyan)
                     [&::-webkit-slider-thumb]:transition-transform
                     active:[&::-webkit-slider-thumb]:scale-110
                     [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-(--color-foreground)
                     [&::-moz-range-thumb]:border-2
                     [&::-moz-range-thumb]:border-(--color-cyan)"
        />
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-2 text-center pt-3">
        <Stat label="배수" value={`${pm.toFixed(2)}x`} accent="cyan" />
        <Stat
          label={mode === "under" ? "목표 (Under)" : "목표 (Over)"}
          value={target.toFixed(2)}
          accent="gold"
        />
        <Stat label="승률" value={`${wc.toFixed(2)}%`} accent="emerald" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "cyan" | "gold" | "emerald";
}) {
  return (
    <div className="glass-1 rounded-xl px-2 py-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
        {label}
      </div>
      <div
        className="font-numeric text-base font-extrabold"
        style={{ color: `var(--color-${accent})` }}
      >
        {value}
      </div>
    </div>
  );
}

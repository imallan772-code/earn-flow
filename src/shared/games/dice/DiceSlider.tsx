/**
 * DiceSlider — interactive target picker with Over/Under mode toggle.
 *
 * Tokens-only. Owner controls `target` + `mode`; this component is pure UI.
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
}

export function DiceSlider({ target, mode, onTargetChange, onModeChange, lastRoll }: Props) {
  const wc = winChance(target, mode);
  const pm = payoutMultiplier(wc);
  const winPct = (target / MAX_ROLL) * 100;

  // bar gradient: Under → win zone is left (emerald), Over → win zone is right (emerald)
  const winColor = "var(--color-emerald)";
  const loseColor = "var(--color-rose)";
  const bg =
    mode === "under"
      ? `linear-gradient(to right, ${winColor} 0%, ${winColor} ${winPct}%, ${loseColor} ${winPct}%, ${loseColor} 100%)`
      : `linear-gradient(to right, ${loseColor} 0%, ${loseColor} ${winPct}%, ${winColor} ${winPct}%, ${winColor} 100%)`;

  const lastPct = lastRoll != null ? Math.min(100, Math.max(0, (lastRoll / MAX_ROLL) * 100)) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* mode toggle */}
      <div className="glass-1 grid grid-cols-2 rounded-xl p-1">
        {(["under", "over"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
              mode === m
                ? "bg-[var(--color-cyan)] text-[var(--color-bg-0)]"
                : "text-[var(--color-muted)]",
            )}
          >
            Roll {m === "under" ? "Under" : "Over"}
          </button>
        ))}
      </div>

      {/* bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ background: bg, opacity: 0.85 }}>
        {/* tick labels */}
        {lastPct != null && (
          <div
            className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-foreground)] shadow-[0_0_8px_var(--color-foreground)]"
            style={{ left: `${lastPct}%` }}
            aria-hidden
          />
        )}
      </div>

      {/* slider input — overlays the bar */}
      <input
        type="range"
        min={1}
        max={Math.floor(MAX_ROLL) - 1}
        step={1}
        value={Math.round(target)}
        onChange={(e) => onTargetChange(Number(e.target.value))}
        className="-mt-3 h-3 w-full cursor-pointer appearance-none bg-transparent
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6
                   [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-[var(--color-foreground)]
                   [&::-webkit-slider-thumb]:shadow-glow-purple
                   [&::-webkit-slider-thumb]:border-2
                   [&::-webkit-slider-thumb]:border-[var(--color-cyan)]
                   [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6
                   [&::-moz-range-thumb]:rounded-full
                   [&::-moz-range-thumb]:bg-[var(--color-foreground)]
                   [&::-moz-range-thumb]:border-2
                   [&::-moz-range-thumb]:border-[var(--color-cyan)]"
      />

      {/* stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Multiplier" value={`${pm.toFixed(4)}x`} accent="cyan" />
        <Stat
          label={mode === "under" ? "Roll Under" : "Roll Over"}
          value={target.toFixed(2)}
          accent="gold"
        />
        <Stat label="Win Chance" value={`${wc.toFixed(2)}%`} accent="emerald" />
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
      <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className="font-numeric text-sm font-extrabold"
        style={{ color: `var(--color-${accent})` }}
      >
        {value}
      </div>
    </div>
  );
}

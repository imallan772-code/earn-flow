/**
 * LimboDisplay — per-slot giant multiplier display with exponential ease-out count-up.
 * Wrapped in LazyMotion at __root.tsx (global). 3D tilt on hover (reduced-motion off).
 */
import { memo, useEffect } from "react";
import { animate, m, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { useTilt } from "@/shared/hooks/useTilt";
import { cn } from "@/lib/utils";

interface Props {
  slot: 0 | 1;
  phase: "idle" | "rolling" | "settled";
  resultCrash: number | null;
  /** 슬롯의 다음 베팅 target (라운드 진행 중이면 active 라운드 target). */
  target: number;
  won: boolean | null;
  active: boolean;
  onActivate: () => void;
}

export const LimboDisplay = memo(function LimboDisplay({
  slot,
  phase,
  resultCrash,
  target,
  won,
  active,
  onActivate,
}: Props) {
  const reduced = useReducedMotion();
  const tiltRef = useTilt<HTMLDivElement>(6);
  const mv = useMotionValue(1);
  const text = useTransform(mv, (v) => `${v.toFixed(2)}x`);

  useEffect(() => {
    if (resultCrash == null) {
      mv.set(1);
      return;
    }
    if (reduced) {
      mv.set(resultCrash);
      return;
    }
    mv.set(1);
    const controls = animate(mv, resultCrash, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [resultCrash, reduced, mv]);

  const displayColor =
    phase === "settled" || phase === "idle"
      ? won === true
        ? "text-emerald"
        : won === false
          ? "text-(--color-rose)"
          : "text-(--color-cyan)"
      : "text-(--color-cyan)";

  return (
    <button
      type="button"
      ref={tiltRef}
      onClick={onActivate}
      aria-pressed={active}
      aria-label={`슬롯 ${slot + 1}`}
      className={cn(
        "glass-2 relative grid w-full place-items-center rounded-2xl px-3 py-6 text-left transition will-change-transform",
        active
          ? "ring-2 ring-(--color-cyan) shadow-glow-cyan"
          : "ring-1 ring-white/5 hover:ring-(--color-cyan)/40",
      )}
    >
      <span className="absolute left-2 top-2 rounded-full bg-(--color-bg-0)/60 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-(--color-muted)">
        Slot {slot + 1}
        {active ? " · AUTO" : ""}
      </span>
      <div className="text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
        결과 배수
      </div>
      {phase === "rolling" ? (
        <m.div
          key="rolling"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          className={cn("font-numeric mt-0.5 text-4xl font-extrabold tabular-nums text-(--color-cyan)")}
        >
          ···
        </m.div>
      ) : (
        <m.span
          className={cn(
            "font-numeric mt-0.5 text-4xl font-extrabold tabular-nums",
            displayColor,
          )}
        >
          {text}
        </m.span>
      )}
      <div className="mt-2 flex items-center gap-1 text-[10px] text-(--color-muted)">
        <TrendingUp size={11} className="text-(--color-cyan)" />
        목표{" "}
        <span className="font-numeric font-extrabold text-gold">{target.toFixed(2)}x</span>
      </div>
    </button>
  );
});

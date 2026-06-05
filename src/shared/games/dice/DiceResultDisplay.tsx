/**
 * DiceResultDisplay — Stake/Roobet style result canvas. No 3D cube, no timer.
 * Big number is the truth; meta on the right shows multiplier / target / win%.
 *
 * ROUND K: settled bounce via LazyMotion + useReducedMotion. 폴백 animate-result-pop.
 */
import { useEffect, useRef, useState } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DiceMode } from "./DiceEngine";

export type DicePhase = "idle" | "rolling" | "settled";

interface Props {
  phase: DicePhase;
  rollValue: number | null;
  outcome: "win" | "loss" | null;
  target: number;
  diceMode: DiceMode;
  payoutMultiplier: number;
  winChancePct: number;
}

export function DiceResultDisplay({
  phase,
  rollValue,
  outcome,
  target,
  diceMode,
  payoutMultiplier,
  winChancePct,
}: Props) {
  const [shuffle, setShuffle] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (phase !== "rolling") {
      setShuffle(null);
      return;
    }
    let last = 0;
    const tick = (ts: number) => {
      if (ts - last > 40) {
        setShuffle(Math.random() * 99.99);
        last = ts;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  const display =
    phase === "rolling" && shuffle != null
      ? shuffle.toFixed(2)
      : rollValue != null
        ? rollValue.toFixed(2)
        : "—";

  const color =
    phase === "rolling"
      ? "var(--color-cyan)"
      : outcome === "win"
        ? "var(--color-emerald)"
        : outcome === "loss"
          ? "var(--color-rose)"
          : "var(--color-foreground)";

  const label =
    phase === "rolling"
      ? "주사위 굴리는 중"
      : phase === "settled"
        ? outcome === "win"
          ? "승리"
          : "패배"
        : "베팅 대기 중";

  const settledBounceKey = `${phase}-${rollValue}`;

  return (
    <div
      className={cn(
        "relative flex h-[140px] w-full items-center justify-between overflow-hidden rounded-2xl border border-(--color-border) px-5",
        outcome === "loss" && phase === "settled" && "animate-crash-shake",
      )}
      style={{
        background:
          "radial-gradient(ellipse 70% 60% at 30% 50%, color-mix(in oklab, var(--color-purple) 16%, transparent), transparent 70%), var(--color-bg-1)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(1 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative">
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-(--color-muted)">
          {label}
        </div>
        <LazyMotion features={domAnimation} strict>
          <m.div
            key={settledBounceKey}
            initial={false}
            animate={
              phase === "settled" && !prefersReducedMotion
                ? { scale: [1, 1.08, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 0.36, ease: "easeOut" }}
            className={cn(
              "font-numeric text-[60px] font-black leading-none tabular-nums transition-colors",
              phase === "settled" && prefersReducedMotion && "animate-result-pop",
            )}
            style={{
              color,
              textShadow:
                outcome === "win"
                  ? "0 0 32px color-mix(in oklab, var(--color-emerald) 60%, transparent)"
                  : outcome === "loss"
                    ? "0 0 32px color-mix(in oklab, var(--color-rose) 60%, transparent)"
                    : phase === "rolling"
                      ? "0 0 22px color-mix(in oklab, var(--color-cyan) 50%, transparent)"
                      : "none",
            }}
          >
            {display}
          </m.div>
        </LazyMotion>
      </div>

      <div className="relative flex flex-col items-end gap-1.5 text-right">
        <MetaRow label="배수" value={`${payoutMultiplier.toFixed(2)}x`} color="var(--color-cyan)" />
        <MetaRow
          label={diceMode === "over" ? "높게" : "낮게"}
          value={target.toFixed(2)}
          color="var(--color-gold)"
        />
        <MetaRow label="승률" value={`${winChancePct.toFixed(2)}%`} color="var(--color-emerald)" />
      </div>
    </div>
  );
}

function MetaRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
        {label}
      </span>
      <span className="font-numeric text-sm font-extrabold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

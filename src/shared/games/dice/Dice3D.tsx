/**
 * Dice3D — pure CSS-3D animated cube with dot faces.
 *
 * Phases:
 *  - idle:    cube slowly auto-rotates, dimmed.
 *  - betting: cube spins faster, glows cyan, countdown ring overlays.
 *  - rolling: cube does a chaotic multi-axis spin (0.8s) with motion blur.
 *  - settled: cube snaps to face matching last roll, win/loss glow + pop.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type DicePhase = "idle" | "betting" | "rolling" | "settled";
export type DiceOutcome = "win" | "loss" | null;

interface Props {
  phase: DicePhase;
  /** Final roll value (0.00-99.99). Used to pick a face when settling. */
  rollValue: number | null;
  outcome: DiceOutcome;
  /** 0..1 for countdown ring during betting phase. */
  bettingProgress?: number;
  /** Seconds remaining in betting phase (for label). */
  secondsLeft?: number;
}

// Dot patterns per face value
const FACE_DOTS: Record<number, Array<[number, number]>> = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
};

const FACE_TRANSFORMS: Record<number, string> = {
  1: "rotateY(0deg) translateZ(60px)",
  2: "rotateY(180deg) translateZ(60px)",
  3: "rotateY(-90deg) translateZ(60px)",
  4: "rotateY(90deg) translateZ(60px)",
  5: "rotateX(90deg) translateZ(60px)",
  6: "rotateX(-90deg) translateZ(60px)",
};

// Snap rotation to show a specific face front
const FACE_SNAP: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateX(0deg) rotateY(-180deg)",
  3: "rotateX(0deg) rotateY(90deg)",
  4: "rotateX(0deg) rotateY(-90deg)",
  5: "rotateX(-90deg) rotateY(0deg)",
  6: "rotateX(90deg) rotateY(0deg)",
};

function rollToFace(roll: number): number {
  // map 0..99.99 to 1..6
  const f = Math.floor((roll / 100) * 6) + 1;
  return Math.min(6, Math.max(1, f));
}

export function Dice3D({ phase, rollValue, outcome, bettingProgress = 0, secondsLeft }: Props) {
  const targetFace = useMemo(() => (rollValue != null ? rollToFace(rollValue) : 1), [rollValue]);
  const [shuffleNum, setShuffleNum] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // shuffle the big number during rolling phase
  useEffect(() => {
    if (phase !== "rolling") {
      setShuffleNum(null);
      return;
    }
    let last = 0;
    const tick = (ts: number) => {
      if (ts - last > 40) {
        setShuffleNum(Math.random() * 99.99);
        last = ts;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  const cubeStyle: React.CSSProperties = (() => {
    if (phase === "rolling") {
      return {
        animation: "dice-roll 0.8s cubic-bezier(0.5, 0, 0.5, 1) both",
      };
    }
    if (phase === "settled") {
      return {
        transform: FACE_SNAP[targetFace],
        transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      };
    }
    if (phase === "betting") {
      return {
        animation: "dice-spin-slow 4s linear infinite",
      };
    }
    return {
      animation: "dice-spin-slow 8s linear infinite",
      opacity: 0.6,
    };
  })();

  const ringColor =
    outcome === "win"
      ? "var(--color-emerald)"
      : outcome === "loss"
        ? "var(--color-rose)"
        : "var(--color-cyan)";

  const faceBgColor =
    outcome === "win"
      ? "color-mix(in oklab, var(--color-emerald) 36%, var(--color-bg-1))"
      : outcome === "loss"
        ? "color-mix(in oklab, var(--color-rose) 36%, var(--color-bg-1))"
        : "color-mix(in oklab, var(--color-cyan) 22%, var(--color-bg-1))";

  const displayNum = phase === "rolling" && shuffleNum != null
    ? shuffleNum.toFixed(2)
    : rollValue != null
      ? rollValue.toFixed(2)
      : "—";

  return (
    <div
      className={cn(
        "relative flex aspect-[5/4] w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)]",
        outcome === "loss" && phase === "settled" && "animate-crash-shake",
      )}
      style={{
        background:
          "radial-gradient(ellipse 70% 60% at 50% 50%, color-mix(in oklab, var(--color-purple) 14%, transparent), transparent 70%), var(--color-bg-1)",
      }}
    >
      {/* grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(1 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* 3D cube */}
      <div
        className="absolute left-6 top-1/2 -translate-y-1/2"
        style={{ perspective: "600px" }}
      >
        <div
          className="relative h-[120px] w-[120px]"
          style={{ transformStyle: "preserve-3d", ...cubeStyle }}
        >
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <div
              key={face}
              className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 rounded-xl border-2 p-2"
              style={{
                transform: FACE_TRANSFORMS[face],
                background: faceBgColor,
                borderColor: ringColor,
                boxShadow: `0 0 20px color-mix(in oklab, ${ringColor} 30%, transparent), inset 0 0 12px color-mix(in oklab, ${ringColor} 20%, transparent)`,
                backfaceVisibility: "hidden",
              }}
            >
              {Array.from({ length: 9 }).map((_, i) => {
                const row = Math.floor(i / 3) + 1;
                const col = (i % 3) + 1;
                const hasDot = FACE_DOTS[face].some(([r, c]) => r === row && c === col);
                return (
                  <span
                    key={i}
                    className="rounded-full"
                    style={{
                      background: hasDot ? "var(--color-foreground)" : "transparent",
                      boxShadow: hasDot ? `0 0 8px ${ringColor}` : "none",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* big number + label */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-right">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-muted)]">
          {phase === "betting"
            ? "베팅 받는 중"
            : phase === "rolling"
              ? "주사위 굴리는 중"
              : phase === "settled"
                ? outcome === "win"
                  ? "승리"
                  : outcome === "loss"
                    ? "패배"
                    : "결과"
                : "대기"}
        </div>
        <div
          key={`${phase}-${rollValue}`}
          className={cn(
            "font-numeric text-5xl font-black tabular-nums transition-colors",
            phase === "settled" && "animate-result-pop",
          )}
          style={{
            color:
              phase === "rolling"
                ? "var(--color-cyan)"
                : outcome === "win"
                  ? "var(--color-emerald)"
                  : outcome === "loss"
                    ? "var(--color-rose)"
                    : "var(--color-foreground)",
            textShadow:
              outcome === "win"
                ? "0 0 28px color-mix(in oklab, var(--color-emerald) 60%, transparent)"
                : outcome === "loss"
                  ? "0 0 28px color-mix(in oklab, var(--color-rose) 60%, transparent)"
                  : phase === "rolling"
                    ? "0 0 20px color-mix(in oklab, var(--color-cyan) 50%, transparent)"
                    : "none",
          }}
        >
          {displayNum}
        </div>
      </div>

      {/* countdown ring (betting phase only) */}
      {phase === "betting" && bettingProgress != null && (
        <svg
          aria-hidden
          className="pointer-events-none absolute bottom-3 right-3 h-12 w-12 -rotate-90"
          viewBox="0 0 40 40"
        >
          <circle cx="20" cy="20" r="17" fill="none" stroke="oklch(1 0 0 / 0.1)" strokeWidth="3" />
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke="var(--color-cyan)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 17}
            strokeDashoffset={2 * Math.PI * 17 * (1 - bettingProgress)}
            style={{
              filter: "drop-shadow(0 0 6px var(--color-cyan))",
              transition: "stroke-dashoffset 100ms linear",
            }}
          />
        </svg>
      )}
      {phase === "betting" && secondsLeft != null && (
        <div className="font-numeric pointer-events-none absolute bottom-5 right-[26px] text-[11px] font-extrabold text-[var(--color-cyan)]">
          {Math.ceil(secondsLeft)}
        </div>
      )}
    </div>
  );
}

import type { RefObject } from "react";
import { cn } from "@/lib/utils";
import type { PlinkoOutcome } from "@/shared/games/state/persistedGameState";
import type { PlinkoPhase } from "./usePlinkoRound";

interface PlinkoCanvasViewProps {
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  phase: PlinkoPhase;
  lastOutcome: PlinkoOutcome | null;
  jackpot: PlinkoOutcome | null;
  onDismissJackpot: () => void;
}

export function PlinkoCanvasView({
  wrapRef,
  canvasRef,
  phase,
  lastOutcome,
  jackpot,
  onDismissJackpot,
}: PlinkoCanvasViewProps) {
  return (
    <div
      ref={wrapRef}
      className="relative h-[460px] w-full overflow-hidden rounded-2xl bg-(--color-bg-1) ring-1 ring-(--color-border)"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      {jackpot && (
        <button
          type="button"
          onClick={onDismissJackpot}
          className="absolute inset-0 grid place-items-center bg-linear-to-b from-[rgba(251,191,36,0.18)] via-transparent to-[rgba(0,0,0,0.4)] animate-fade-in"
          aria-label="잭팟"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#fde68a]">
              JACKPOT
            </div>
            <div
              className="font-numeric text-6xl font-black text-[#fde68a] animate-scale-in"
              style={{
                textShadow: "0 0 28px rgba(251,191,36,0.9), 0 0 60px rgba(251,191,36,0.6)",
              }}
            >
              {jackpot.multiplier}x
            </div>
            <div className="font-numeric text-2xl font-extrabold text-[#fef3c7]">
              +{jackpot.profit.toFixed(2)} USDT
            </div>
          </div>
        </button>
      )}

      {phase === "settled" && lastOutcome && !jackpot && (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-xl px-3 py-1.5 text-center backdrop-blur animate-fade-in",
            lastOutcome.outcome === "win"
              ? "bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)]"
              : "bg-[color-mix(in_oklab,var(--color-rose)_22%,transparent)]",
          )}
        >
          <div
            className={cn(
              "font-numeric text-sm font-extrabold leading-tight",
              lastOutcome.outcome === "win"
                ? "text-emerald"
                : "text-(--color-rose)",
            )}
          >
            {lastOutcome.outcome === "win" ? "+" : ""}
            {lastOutcome.profit.toFixed(2)} USDT
          </div>
          <div className="font-numeric text-[10px] text-muted-2">
            {lastOutcome.bet.toFixed(2)} × {lastOutcome.multiplier}x ={" "}
            {lastOutcome.payout.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

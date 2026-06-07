/**
 * CrashMultiplierBadge — running/crashed 시 Canvas 위에 떠 있는 라이브 배수 오버레이.
 *
 * - sharedTickLoop 구독으로 60Hz 갱신. reduced-motion ON → pulse off.
 * - 색 tier: <2x muted · 2~10x cyan · 10~100x gold · ≥100x rose.
 * - 비주얼 전용. 정산/로직 0.
 */
import { memo, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { sharedTickLoop } from "@/shared/games/engine/tickLoop";
import { cn } from "@/lib/utils";

interface Props {
  /** 매 프레임 호출되는 현재 배수 getter. */
  getCurrentMultiplier: () => number;
  /** Crash 진행 phase. */
  phase: "betting" | "running" | "crashed" | "cooldown";
  /** crashed/cooldown 시 표시할 최종 배수. */
  crashPoint: number;
}

function tierColor(mult: number, busted: boolean): string {
  if (busted) return "text-(--color-rose)";
  if (mult >= 100) return "text-(--color-rose)";
  if (mult >= 10) return "text-gold";
  if (mult >= 2) return "text-(--color-cyan)";
  return "text-(--color-foreground)";
}

export const CrashMultiplierBadge = memo(function CrashMultiplierBadge({
  getCurrentMultiplier,
  phase,
  crashPoint,
}: Props) {
  const reduced = useReducedMotion() ?? false;
  const [m, setM] = useState(1.0);

  useEffect(() => {
    if (phase !== "running") return;
    const loop = sharedTickLoop();
    let lastPaint = 0;
    const unsub = loop.subscribe((_dt, ts) => {
      if (ts - lastPaint < 50) return;
      lastPaint = ts;
      const cur = getCurrentMultiplier();
      setM((prev) => (Math.abs(prev - cur) > 0.001 ? cur : prev));
    });
    return () => unsub();
  }, [phase, getCurrentMultiplier]);

  if (phase === "betting") return null;

  const isBusted = phase === "crashed" || phase === "cooldown";
  const value = isBusted ? (Number.isFinite(crashPoint) ? crashPoint : 1) : m;
  const color = tierColor(value, isBusted);

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 select-none",
        !reduced && phase === "running" && "animate-phon-pulse",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "font-numeric rounded-full bg-(--color-bg-0)/70 px-3 py-1 text-xs font-extrabold tabular-nums backdrop-blur-sm",
          color,
        )}
      >
        {value.toFixed(2)}x
      </div>
    </div>
  );
});

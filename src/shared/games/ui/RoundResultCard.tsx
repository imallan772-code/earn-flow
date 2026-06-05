import { useEffect, useState } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  outcome: "win" | "loss";
  profit: number;
  multiplier?: number;
  nonce?: number;
  onDone?: () => void;
}

export function RoundResultCard({ outcome, profit, multiplier, nonce, onDone }: Props) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1600);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  const win = outcome === "win";

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={reduced ? false : { opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        className={cn(
          "pointer-events-none absolute inset-x-4 top-1/3 z-20 rounded-2xl border px-4 py-3 text-center shadow-lg",
          win
            ? "border-[color-mix(in_oklab,var(--color-gold)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-gold)_12%,transparent)]"
            : "border-[color-mix(in_oklab,var(--color-rose)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-rose)_12%,transparent)]",
        )}
      >
        <p className={cn("text-sm font-extrabold", win ? "text-gold" : "text-(--color-rose)")}>
          {win ? "승리" : "패배"}
        </p>
        <p className="font-numeric mt-1 text-lg font-extrabold">
          {profit >= 0 ? "+" : ""}
          {profit.toFixed(2)}
        </p>
        {multiplier != null ? (
          <p className="font-numeric text-[11px] text-(--color-muted)">{multiplier.toFixed(2)}x</p>
        ) : null}
        {nonce != null ? <p className="font-numeric text-[10px] text-muted-2">#{nonce}</p> : null}
      </m.div>
    </LazyMotion>
  );
}

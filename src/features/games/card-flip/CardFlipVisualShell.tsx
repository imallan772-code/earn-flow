import { useState } from "react";
import { motion } from "framer-motion";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SYMBOLS = ["💎", "🔥", "⭐", "🚀", "💎", "🔥", "⭐", "🚀"];

/** // MERGE: CardFlipGameAdapter reconnect */
export function CardFlipVisualShell() {
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [streak, setStreak] = useState(3);

  function flip(i: number) {
    if (flipped.includes(i) || matched.includes(i)) return;
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      const [a, b] = next;
      if (SYMBOLS[a] === SYMBOLS[b]) {
        setTimeout(() => {
          setMatched((m) => [...m, a, b]);
          setFlipped([]);
          setStreak((s) => s + 1);
          toast.success("💎 매치! +1,200 PHON");
        }, 400);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setStreak(0);
        }, 700);
      }
    }
  }

  return (
    <>
      <LiveCashoutStrip />
      <Premium3DCard className="p-4 text-center" glow="cyan">
        <div className="text-xs text-[var(--color-muted)]">메모리 연승</div>
        <div className="font-numeric text-4xl font-extrabold text-holographic">{streak}</div>
        <div className="mt-0.5 text-[11px] text-[var(--color-cyan)]">5연승 시 보너스 폭발</div>
      </Premium3DCard>
      <div className="grid grid-cols-4 gap-2">
        {SYMBOLS.map((s, i) => {
          const open = flipped.includes(i) || matched.includes(i);
          return (
            <button
              key={i}
              onClick={() => flip(i)}
              className="relative aspect-square"
              style={{ perspective: 600 }}
            >
              <motion.div
                animate={{ rotateY: open ? 180 : 0 }}
                transition={{ duration: 0.35 }}
                className="relative h-full w-full"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className={cn("absolute inset-0 rounded-2xl glass-3 shadow-depth-2 flex items-center justify-center text-2xl")}
                  style={{ backfaceVisibility: "hidden", background: "var(--color-surface-hi)" }}>
                  ?
                </div>
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center text-3xl"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background: matched.includes(i) ? "color-mix(in oklab, var(--color-emerald) 22%, transparent)" : "var(--color-bg-1)",
                    border: "1px solid var(--color-border-hi)",
                    borderRadius: 16,
                  }}>
                  {s}
                </div>
              </motion.div>
            </button>
          );
        })}
      </div>
    </>
  );
}

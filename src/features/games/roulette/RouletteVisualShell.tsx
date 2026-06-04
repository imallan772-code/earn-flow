import { useState } from "react";
import { motion } from "framer-motion";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { toast } from "sonner";

const NUMS = Array.from({ length: 12 }, (_, i) => i + 1);

/** // MERGE: RouletteGameAdapter reconnect */
export function RouletteVisualShell() {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [pick, setPick] = useState<number | null>(null);

  function spin(n: number) {
    setPick(n);
    setSpinning(true);
    const target = 360 * 6 + Math.random() * 360;
    setAngle((a) => a + target);
    setTimeout(() => {
      setSpinning(false);
      toast.success("🎯 +5,400 PHON 적중!");
    }, 2200);
  }

  return (
    <>
      <LiveCashoutStrip />
      <Premium3DCard className="flex flex-col items-center p-6" glow="pink">
        <motion.div
          animate={{ rotate: angle }}
          transition={{ duration: 2.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative h-44 w-44 rounded-full bg-holographic shadow-glow-purple"
          style={{
            background: "conic-gradient(from 0deg, var(--color-cyan), var(--color-purple), var(--color-pink), var(--color-gold), var(--color-cyan))",
          }}
        >
          <div className="absolute inset-3 rounded-full bg-[var(--color-bg-1)] flex items-center justify-center font-numeric text-3xl font-extrabold">
            {pick ?? "?"}
          </div>
        </motion.div>
        <div className="mt-3 text-[11px] text-[var(--color-muted)]">35배 적중 가능 · 핫넘버 7, 13, 22</div>
      </Premium3DCard>
      <div className="grid grid-cols-6 gap-1.5">
        {NUMS.map((n) => (
          <button
            key={n}
            onClick={() => spin(n)}
            disabled={spinning}
            className="glass-2 flex aspect-square items-center justify-center rounded-xl font-numeric text-sm font-bold transition-transform active:scale-95"
          >
            {n}
          </button>
        ))}
      </div>
    </>
  );
}

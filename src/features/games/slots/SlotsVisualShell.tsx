import { useState } from "react";
import { motion } from "framer-motion";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { toast } from "sonner";

const SYM = ["7️⃣", "🍒", "💎", "⭐", "🔔", "🍋"];

/** // MERGE: SlotsGameAdapter reconnect */
export function SlotsVisualShell() {
  const [reels, setReels] = useState([0, 1, 2]);
  const [spinning, setSpinning] = useState(false);

  function spin() {
    setSpinning(true);
    let ticks = 0;
    const id = setInterval(() => {
      setReels(reels.map(() => Math.floor(Math.random() * SYM.length)));
      ticks++;
      if (ticks > 12) {
        clearInterval(id);
        setSpinning(false);
        toast.success("🎰 +3,200 PHON 적중!");
      }
    }, 70);
  }

  return (
    <>
      <LiveCashoutStrip />
      <Premium3DCard className="p-6" glow="gold">
        <div className="text-center text-xs text-[var(--color-muted)]">🔥 잭팟 누적</div>
        <div className="text-center font-numeric text-2xl font-extrabold text-[var(--color-gold)]">8,420,000 PHON</div>
        <div className="mt-5 flex justify-center gap-2">
          {reels.map((r, i) => (
            <motion.div
              key={i}
              animate={{ scale: spinning ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 0.15, repeat: spinning ? Infinity : 0 }}
              className="glass-2 flex h-24 w-20 items-center justify-center rounded-2xl text-5xl shadow-depth-2"
            >
              {SYM[r]}
            </motion.div>
          ))}
        </div>
      </Premium3DCard>
      <button
        onClick={spin}
        disabled={spinning}
        className="h-14 rounded-2xl bg-holographic font-extrabold text-[var(--color-bg-0)] shadow-glow-purple disabled:opacity-50"
      >
        {spinning ? "스핀 중…" : "SPIN · 1,000 PHON"}
      </button>
    </>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift } from "lucide-react";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { toast } from "sonner";

/** // MERGE: LuckyBoxGameAdapter reconnect */
export function LuckyBoxVisualShell() {
  const [opened, setOpened] = useState(false);
  const [reward, setReward] = useState(0);

  function open() {
    const r = [200, 500, 1500, 3000, 12000][Math.floor(Math.random() * 5)];
    setReward(r);
    setOpened(true);
    toast.success(`🎁 +${r.toLocaleString()} PHON`);
  }

  return (
    <>
      <LiveCashoutStrip />
      <Premium3DCard className="flex flex-col items-center justify-center p-8" glow="purple">
        <div className="text-xs text-[var(--color-muted)]">오늘의 럭키 박스 · 일일 1회</div>
        <AnimatePresence mode="wait">
          {!opened ? (
            <motion.button
              key="box"
              onClick={open}
              whileHover={{ rotateY: 8, rotateX: -6 }}
              whileTap={{ scale: 0.92 }}
              className="my-8 flex h-36 w-36 items-center justify-center rounded-3xl bg-holographic shadow-glow-purple"
              style={{ transformStyle: "preserve-3d" }}
            >
              <Gift size={64} className="text-[var(--color-bg-0)]" />
            </motion.button>
          ) : (
            <motion.div
              key="reward"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="my-8 text-center"
            >
              <div className="font-numeric text-5xl font-extrabold text-holographic">+{reward.toLocaleString()}</div>
              <div className="mt-1 text-sm text-[var(--color-gold)]">PHON</div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="text-[11px] text-[var(--color-muted)]">최대 12,000 PHON · 레전더리 드랍 1.4%</div>
      </Premium3DCard>
    </>
  );
}

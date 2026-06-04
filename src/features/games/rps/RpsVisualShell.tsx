import { useState } from "react";
import { motion } from "framer-motion";
import { Hand } from "lucide-react";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { toast } from "sonner";

type Choice = "rock" | "paper" | "scissors";
const LABEL: Record<Choice, string> = { rock: "✊ 바위", paper: "✋ 보", scissors: "✌️ 가위" };

/** // MERGE: RpsGameAdapter reconnect — handlers replaced by useGameWallet */
export function RpsVisualShell() {
  const [pick, setPick] = useState<Choice | null>(null);
  const [streak, setStreak] = useState(7);

  function play(c: Choice) {
    setPick(c);
    const win = Math.random() > 0.5;
    setStreak((s) => (win ? s + 1 : 0));
    toast.success(win ? "🎉 승리 +2,400 PHON" : "다음 판 도전!");
    setTimeout(() => setPick(null), 1100);
  }

  return (
    <>
      <LiveCashoutStrip />
      <Premium3DCard className="p-5 text-center" glow="pink">
        <div className="text-xs text-[var(--color-muted)]">현재 연승</div>
        <div className="mt-1 font-numeric text-5xl font-extrabold text-holographic">{streak}</div>
        <div className="mt-1 text-[11px] text-[var(--color-pink)]">연승 보너스 폭주 중</div>
        <div className="mt-6 flex h-40 items-center justify-center">
          {pick ? (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.4, opacity: 1 }}
              className="text-7xl"
            >
              {LABEL[pick].split(" ")[0]}
            </motion.div>
          ) : (
            <Hand size={64} style={{ color: "var(--color-pink)" }} />
          )}
        </div>
      </Premium3DCard>

      <div className="grid grid-cols-3 gap-2">
        {(["rock", "paper", "scissors"] as Choice[]).map((c) => (
          <button
            key={c}
            onClick={() => play(c)}
            className="glass-3 flex h-24 flex-col items-center justify-center gap-1 rounded-2xl text-2xl font-bold transition-transform active:scale-95 shadow-depth-2 hover:shadow-glow-pink"
          >
            {LABEL[c]}
          </button>
        ))}
      </div>
    </>
  );
}

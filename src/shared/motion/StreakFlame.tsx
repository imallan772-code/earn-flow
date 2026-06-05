import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface Props {
  days: number;
  size?: number;
}

export function StreakFlame({ days, size = 56 }: Props) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <motion.div
        className="absolute inset-0 rounded-full shadow-glow-pink"
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <Flame
        size={size * 0.55}
        className="relative z-10"
        style={{ color: "var(--color-gold)" }}
        strokeWidth={2.2}
      />
      <span
        className="absolute -bottom-1 right-0 z-20 rounded-full px-1.5 py-0.5 text-[10px] font-bold font-numeric"
        style={{
          background: "var(--color-bg-1)",
          color: "var(--color-gold)",
          border: "1px solid var(--color-gold)",
        }}
      >
        {days}
      </span>
    </div>
  );
}

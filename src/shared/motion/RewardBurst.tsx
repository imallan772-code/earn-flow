import { motion } from "framer-motion";
import { useMemo } from "react";

interface Props {
  trigger: number; // changing value re-fires
  count?: number;
}

export function RewardBurst({ trigger, count = 10 }: Props) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const particles = useMemo(() => {
    const n = reduced ? 0 : Math.min(12, count);
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      angle: (i / n) * Math.PI * 2,
      dist: 60 + Math.random() * 40,
      delay: Math.random() * 0.08,
    }));
  }, [count, reduced, trigger]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {particles.map((p) => (
        <motion.span
          key={`${trigger}-${p.id}`}
          className="absolute h-2 w-2 rounded-full bg-holographic"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist,
            opacity: 0,
            scale: 0.4,
          }}
          transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

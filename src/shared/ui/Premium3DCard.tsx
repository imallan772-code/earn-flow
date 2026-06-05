import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
  glow?: "cyan" | "purple" | "pink" | "gold";
  onClick?: () => void;
  interactive?: boolean;
}

const glowClass = {
  cyan: "shadow-glow-cyan",
  purple: "shadow-glow-purple",
  pink: "shadow-glow-pink",
  gold: "shadow-glow-gold",
};

export function Premium3DCard({ children, className, glow, onClick, interactive }: Props) {
  const Cmp = interactive ? motion.button : motion.div;
  return (
    <Cmp
      onClick={onClick}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      whileHover={interactive ? { y: -2 } : undefined}
      className={cn(
        "glass-3 relative overflow-hidden rounded-3xl shadow-depth-2 text-left",
        glow && glowClass[glow],
        className,
      )}
    >
      {children}
    </Cmp>
  );
}

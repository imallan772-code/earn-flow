import { cn } from "@/lib/utils";
import { Clock, Sparkles, Flame } from "lucide-react";

interface Props {
  text: string;
  variant?: "deadline" | "seats" | "hot";
  className?: string;
}

const variantCfg = {
  deadline: { Icon: Clock, color: "var(--color-pink)" },
  seats: { Icon: Sparkles, color: "var(--color-cyan)" },
  hot: { Icon: Flame, color: "var(--color-gold)" },
};

export function UrgencyBadge({ text, variant = "hot", className }: Props) {
  const { Icon, color } = variantCfg[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold animate-phon-pulse",
        className,
      )}
      style={{
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
      }}
    >
      <Icon size={11} />
      {text}
    </span>
  );
}

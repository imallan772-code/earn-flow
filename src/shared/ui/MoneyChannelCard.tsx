import { ChevronRight, type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  to: string;
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  meta?: string;
  accent?: "cyan" | "purple" | "pink" | "gold";
}

const accentColor = {
  cyan: "var(--color-cyan)",
  purple: "var(--color-purple)",
  pink: "var(--color-pink)",
  gold: "var(--color-gold)",
} as const;

/** 거래소 톤 — 입출금/transfer 채널 카드. 차분, 표준어 */
export function MoneyChannelCard({ to, Icon, title, subtitle, meta, accent = "cyan" }: Props) {
  const color = accentColor[accent];
  return (
    <Link to={to} className="glass-2 flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-white/5">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-[var(--color-muted)]">{subtitle}</div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        {meta}
        <ChevronRight size={16} />
      </div>
    </Link>
  );
}

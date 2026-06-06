import { Users } from "lucide-react";
import { CountUp } from "../motion/CountUp";
import { useLiveOnline } from "../motion/liveOnlineStore";

const KO = new Intl.NumberFormat("ko-KR");

export function OnlineCounterChip({ compact }: { compact?: boolean }) {
  const value = useLiveOnline();
  return (
    <div className="glass-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow-glow-cyan">
      <span
        className="inline-flex h-2 w-2 animate-phon-pulse rounded-full"
        style={{ background: "var(--color-emerald)" }}
      />
      <Users size={14} style={{ color: "var(--color-cyan)" }} />
      <span className="font-numeric text-sm font-semibold text-(--color-foreground)">
        <CountUp value={value} duration={1400} format={(n) => KO.format(Math.round(n))} />
      </span>
      {!compact && <span className="text-xs text-(--color-muted)">· 10M+ online</span>}
    </div>
  );
}

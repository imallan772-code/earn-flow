import { Users } from "lucide-react";
import { LiveNumber } from "../motion/LiveNumber";
import { MOCK_ONLINE_BASE } from "@/mocks/fomo";

const KO = new Intl.NumberFormat("ko-KR");

export function OnlineCounterChip({ compact }: { compact?: boolean }) {
  return (
    <div className="glass-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow-glow-cyan">
      <span className="inline-flex h-2 w-2 animate-phon-pulse rounded-full" style={{ background: "var(--color-emerald)" }} />
      <Users size={14} style={{ color: "var(--color-cyan)" }} />
      <span className="font-numeric text-sm font-semibold text-[var(--color-foreground)]">
        <LiveNumber
          base={MOCK_ONLINE_BASE}
          amplitudeRatio={0.0025}
          bias={0.52}
          intervalMs={2800}
          format={(n) => KO.format(Math.round(n))}
        />
      </span>
      {!compact && <span className="text-xs text-[var(--color-muted)]">실시간 접속</span>}
    </div>
  );
}

import { MOCK_CASHOUT_FEED, MOCK_CONCURRENT_PEAK } from "@/mocks/fomo";
import { formatPHON } from "@/lib/format";
import { TrendingUp } from "lucide-react";
import { LiveNumber } from "../motion/LiveNumber";

const KO = new Intl.NumberFormat("ko-KR");

export function LiveCashoutStrip() {
  const doubled = [...MOCK_CASHOUT_FEED, ...MOCK_CASHOUT_FEED];
  return (
    <div className="glass-1 overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--color-border)" }}>
        <span className="inline-flex h-2 w-2 animate-phon-pulse rounded-full" style={{ background: "var(--color-emerald)" }} />
        <span className="text-xs font-semibold text-[var(--color-muted)]">
          실시간 캐시아웃 ·{" "}
          <LiveNumber
            base={MOCK_CONCURRENT_PEAK}
            amplitudeRatio={0.012}
            bias={0.5}
            intervalMs={3200}
            format={(n) => `${KO.format(Math.round(n / 1000))}천 명 접속 중`}
          />
        </span>
      </div>
      <div className="relative w-full overflow-hidden">
        <div className="flex w-max gap-5 whitespace-nowrap py-2.5 px-3 animate-marquee">
          {doubled.map((t, i) => (
            <span key={t.id + i} className="inline-flex items-center gap-1.5 text-sm">
              <TrendingUp size={14} style={{ color: "var(--color-emerald)" }} />
              <span className="font-medium text-[var(--color-foreground)]">{t.name}</span>
              {t.multiplier && (
                <span className="font-numeric text-xs" style={{ color: "var(--color-cyan)" }}>{t.multiplier.toFixed(1)}×</span>
              )}
              <span className="font-numeric font-semibold" style={{ color: "var(--color-gold)" }}>
                +{formatPHON(t.amount)} PHON
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

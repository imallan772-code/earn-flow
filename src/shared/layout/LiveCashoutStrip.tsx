import { useEffect, useSyncExternalStore } from "react";
import { TrendingUp, Globe2 } from "lucide-react";
import { formatPHON, formatUSDT, formatCompact } from "@/lib/format";
import { LiveNumber } from "../motion/LiveNumber";
import {
  cashoutStripStore,
  startCashoutBot,
  type CashoutEvent,
} from "@/shared/livefeed/cashoutStripStore";
import { globalLiveStats } from "@/shared/livefeed/globalLiveStats";

function CashoutChip({ event }: { event: CashoutEvent }) {
  const isUsdt = event.currency === "USDT";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="text-[10px]">{event.flag}</span>
      <TrendingUp size={13} style={{ color: "var(--color-emerald)" }} />
      <span className="font-medium text-(--color-foreground)">{event.name}</span>
      {event.multiplier != null && (
        <span className="font-numeric text-xs" style={{ color: "var(--color-cyan)" }}>
          {event.multiplier.toFixed(1)}×
        </span>
      )}
      <span
        className="font-numeric font-semibold"
        style={{ color: isUsdt ? "var(--color-emerald)" : "var(--color-gold)" }}
      >
        +{isUsdt ? `${formatUSDT(event.amount)} USDT` : `${formatPHON(event.amount)} PHON`}
      </span>
    </span>
  );
}

export function LiveCashoutStrip() {
  useEffect(() => startCashoutBot(), []);

  const events = useSyncExternalStore(
    cashoutStripStore.subscribe,
    cashoutStripStore.getEvents,
    cashoutStripStore.getEvents,
  );
  const cashoutPhon = useSyncExternalStore(
    globalLiveStats.subscribe,
    globalLiveStats.getCashoutPhonToday,
    globalLiveStats.getCashoutPhonToday,
  );
  const cashoutUsdt = useSyncExternalStore(
    globalLiveStats.subscribe,
    globalLiveStats.getCashoutUsdtToday,
    globalLiveStats.getCashoutUsdtToday,
  );
  const bps = useSyncExternalStore(
    globalLiveStats.subscribe,
    globalLiveStats.getBetsPerSecond,
    globalLiveStats.getBetsPerSecond,
  );

  const marquee = events.length > 0 ? [...events.slice(0, 12), ...events.slice(0, 12)] : [];

  return (
    <div className="glass-1 overflow-hidden rounded-2xl">
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span
          className="inline-flex h-2 w-2 shrink-0 animate-phon-pulse rounded-full"
          style={{ background: "var(--color-emerald)" }}
        />
        <Globe2 size={12} className="shrink-0 text-(--color-muted)" />
        <span className="text-[11px] font-semibold text-(--color-muted)">
          실시간 캐시아웃 ·{" "}
          <LiveNumber
            base={cashoutPhon}
            amplitudeRatio={0.004}
            bias={0.55}
            intervalMs={4800}
            format={(n) => `${formatPHON(Math.round(n))} PHON`}
          />
          {" / "}
          <LiveNumber
            base={cashoutUsdt}
            amplitudeRatio={0.006}
            bias={0.55}
            intervalMs={5200}
            format={(n) => `${formatUSDT(n)} USDT`}
          />
        </span>
        <span className="ml-auto font-numeric text-[10px] text-muted-2">
          {formatCompact(bps)}/s · 10M+ online
        </span>
      </div>
      <div className="relative w-full overflow-hidden">
        <div className="flex w-max gap-5 whitespace-nowrap py-2.5 px-3 animate-marquee-slow">
          {marquee.map((t, i) => (
            <CashoutChip key={t.id + i} event={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

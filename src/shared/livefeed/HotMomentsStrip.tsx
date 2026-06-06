/**
 * HotMomentsStrip — global win highlights (FOMO display only).
 */
import { useSyncExternalStore } from "react";
import { TrendingUp } from "lucide-react";
import { formatPHON, formatUSDT, formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { feedStreamStore } from "./FeedStreamStore";
import { globalLiveStats } from "./globalLiveStats";
import type { HotMoment } from "./FeedStreamStore";

const VISIBLE = 6;
const CARD_W = 168;

function formatHotAmount(h: HotMoment): string {
  if (h.currency === "USDT") return `+${formatUSDT(h.amount)} USDT`;
  return `+${formatPHON(h.amount)} PHON`;
}

export function HotMomentsStrip() {
  const moments = useSyncExternalStore(
    feedStreamStore.subscribe,
    feedStreamStore.getHotMoments,
    feedStreamStore.getHotMoments,
  );
  const winsToday = useSyncExternalStore(
    globalLiveStats.subscribe,
    globalLiveStats.getWinsToday,
    globalLiveStats.getWinsToday,
  );
  const concurrent = useSyncExternalStore(
    globalLiveStats.subscribe,
    globalLiveStats.getConcurrentBettors,
    globalLiveStats.getConcurrentBettors,
  );

  const view = moments.slice(0, VISIBLE);

  return (
    <section className="glass-2 rounded-2xl p-3">
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-(--color-muted)">
          <TrendingUp size={12} className="text-pink" />
          오늘의 핫 모먼트
        </h3>
        <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[10px] text-muted-2">
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex h-1.5 w-1.5 animate-phon-pulse rounded-full bg-emerald" />
            LIVE
          </span>
          <span>{formatCompact(concurrent)} betting</span>
          <span className="text-(--color-border)">·</span>
          <span className="font-numeric font-bold text-gold">
            {formatCompact(winsToday)} wins today
          </span>
        </span>
      </header>
      <div
        className={cn(
          "relative -mx-0.5 overflow-x-auto overflow-y-hidden pb-0.5 scrollbar-none",
          "mask-[linear-gradient(to_right,transparent,black_10px,black_calc(100%-10px),transparent)]",
        )}
      >
        <div className="flex w-max gap-2 px-0.5">
          {view.map((h) => (
            <article
              key={h.id}
              className="glass-1 shrink-0 rounded-xl border border-(--color-border) p-2.5"
              style={{ width: CARD_W }}
            >
              <div className="truncate text-[10px] text-muted-2">{h.name}</div>
              <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-(--color-foreground)">
                {h.action}
              </div>
              <div
                className="mt-1.5 font-numeric text-sm font-extrabold"
                style={{
                  color: h.currency === "USDT" ? "var(--color-emerald)" : "var(--color-gold)",
                }}
              >
                {formatHotAmount(h)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

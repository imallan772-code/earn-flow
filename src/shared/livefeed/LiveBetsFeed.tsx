/**
 * LiveBetsFeed — global Stake-style live bet ticker.
 *
 * - Subscribes to LiveBetsStore via useSyncExternalStore.
 * - Auto-starts the bot generator + initial seed on mount (ref-counted).
 * - Highlights the current user's own bets with a cyan accent.
 * - When `virtualized` (or limit > 50) is set, uses LiveBetsVirtualList
 *   (react-window) so 500-row scenarios stay smooth.
 *
 * ROUND P-PR2: filter chips (memory state)
 *  - `game` prop이 있으면 칩 렌더 X (게임 dock/inline 0 변화).
 *  - All / Big wins (multiplier ≥ 10) / Me only (isMe).
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Users, Globe2 } from "lucide-react";
import {
  liveBetsStore,
  seedInitialBets,
  orderLiveBetsForView,
  type LiveBet,
} from "./LiveBetsStore";
import { startBotFeed } from "./botGenerator";
import { LiveBetsVirtualList } from "./LiveBetsVirtualList";
import { LiveBetRow, ROW_GRID } from "./LiveBetRow";
import { applyFeedFilter, type FeedFilter } from "./feedFilter";
import { cn } from "@/lib/utils";
import { RollingCountUp } from "@/shared/motion/RollingCountUp";

interface Props {
  /** Max rows to render (default 12). */
  limit?: number;
  /** Show header bar. */
  showHeader?: boolean;
  /** Filter by game. */
  game?: LiveBet["game"];
  className?: string;
  /** Force virtualization on. Auto-on when limit > 50. */
  virtualized?: boolean;
  /** Pixel height for the virtualized list. Default 360. */
  virtualHeight?: number;
}

const CHIPS: ReadonlyArray<{ id: FeedFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "big", label: "Big wins" },
  { id: "me", label: "나만" },
];

export function LiveBetsFeed({
  limit = 12,
  showHeader = true,
  game,
  className,
  virtualized,
  virtualHeight = 360,
}: Props) {
  useEffect(() => {
    seedInitialBets(24);
    const stop = startBotFeed();
    return () => {
      stop();
    };
  }, []);

  const bets = useSyncExternalStore(liveBetsStore.subscribe, liveBetsStore.getSnapshot, () =>
    liveBetsStore.getSnapshot(),
  );
  const total = useSyncExternalStore(liveBetsStore.subscribe, liveBetsStore.getTotalVolume, () =>
    liveBetsStore.getTotalVolume(),
  );

  const [filter, setFilter] = useState<FilterId>("all");
  const showChips = !game;

  const view = useMemo(() => {
    const ordered = orderLiveBetsForView(bets, game);
    const filtered = showChips ? applyFeedFilter(ordered, filter) : ordered;
    return filtered.slice(0, limit);
  }, [bets, game, showChips, filter, limit]);

  const useVirtual = virtualized ?? limit > 50;

  return (
    <section className={cn("glass-2 rounded-2xl p-3", className)}>
      {showHeader && (
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-(--color-muted)">
            <span className="inline-flex h-2 w-2 animate-phon-pulse rounded-full bg-emerald" />
            <Globe2 size={12} /> 글로벌 라이브 베팅
          </h3>
          <span className="flex items-center gap-2 text-[10px] text-muted-2">
            <Users size={10} />
            <span className="font-numeric font-bold text-(--color-foreground)">
              <RollingCountUp base={1_240_000} />
            </span>
            <span>· 누적</span>
            <span className="font-numeric font-bold text-gold">
              {(total / 1000).toFixed(1)}K USDT
            </span>
          </span>
        </header>
      )}

      {showChips && (
        <div role="tablist" aria-label="라이브 피드 필터" className="mb-2 flex items-center gap-1">
          {CHIPS.map((c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(c.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                  active
                    ? "bg-(--color-cyan) text-(--color-bg-0)"
                    : "bg-(--color-surface-hi) text-(--color-muted) hover:text-(--color-foreground)",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          ROW_GRID,
          "mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-2",
        )}
        aria-hidden
      >
        <span />
        <span>유저</span>
        <span className="text-right">베팅</span>
        <span className="text-right">배수</span>
        <span className="text-right">손익</span>
      </div>

      {useVirtual ? (
        <LiveBetsVirtualList bets={view} height={virtualHeight} />
      ) : (
        <ul className="flex flex-col">
          {view.length === 0 ? (
            <li className="py-4 text-center text-[11px] text-muted-2">베팅 대기 중...</li>
          ) : (
            view.map((b) => <LiveBetRow key={b.id} bet={b} />)
          )}
        </ul>
      )}
    </section>
  );
}

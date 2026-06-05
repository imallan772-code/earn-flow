/**
 * LiveBetsFeed — global Stake-style live bet ticker.
 *
 * - Subscribes to LiveBetsStore via useSyncExternalStore.
 * - Auto-starts the bot generator + initial seed on mount (ref-counted).
 * - Highlights the current user's own bets with a cyan accent.
 */
import { useEffect, useSyncExternalStore } from "react";
import { Users, Globe2 } from "lucide-react";
import { liveBetsStore, seedInitialBets, type LiveBet } from "./LiveBetsStore";
import { startBotFeed } from "./botGenerator";
import { cn } from "@/lib/utils";
import { RollingCountUp } from "@/shared/motion/RollingCountUp";

const GAME_LABEL: Record<LiveBet["game"], string> = {
  crash: "Crash",
  dice: "Dice",
  plinko: "Plinko",
  slots: "Slots",
  mines: "Mines",
  roulette: "Roulette",
  limbo: "Limbo",
  wheel: "Wheel",
};

const GAME_ACCENT: Record<LiveBet["game"], string> = {
  crash: "var(--color-cyan)",
  dice: "var(--color-emerald)",
  plinko: "var(--color-gold)",
  slots: "var(--color-pink)",
  mines: "var(--color-warning)",
  roulette: "var(--color-purple)",
  limbo: "var(--color-purple)",
  wheel: "var(--color-gold)",
};

interface Props {
  /** Max rows to render (default 12). */
  limit?: number;
  /** Show header bar. */
  showHeader?: boolean;
  /** Filter by game. */
  game?: LiveBet["game"];
  className?: string;
}

export function LiveBetsFeed({ limit = 12, showHeader = true, game, className }: Props) {
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

  const filtered = game ? bets.filter((b) => b.game === game) : bets;
  const view = filtered.slice(0, limit);

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

      <ul className="flex flex-col">
        {view.length === 0 ? (
          <li className="py-4 text-center text-[11px] text-muted-2">베팅 대기 중...</li>
        ) : (
          view.map((b) => <LiveBetRow key={b.id} bet={b} />)
        )}
      </ul>
    </section>
  );
}

function LiveBetRow({ bet }: { bet: LiveBet }) {
  const profitColor =
    bet.profit == null || bet.status === "pending"
      ? "var(--color-muted-2)"
      : bet.profit > 0
        ? "var(--color-emerald)"
        : "var(--color-rose)";

  const profitText =
    bet.status === "pending"
      ? "—"
      : bet.profit != null && bet.profit > 0
        ? `+${bet.profit.toFixed(2)}`
        : bet.profit != null
          ? `${bet.profit.toFixed(2)}`
          : "—";

  const multText =
    bet.multiplier != null && bet.multiplier > 0
      ? `${bet.multiplier.toFixed(2)}x`
      : bet.status === "bust"
        ? "BUST"
        : "—";

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 border-b border-(--color-border) py-1.5 text-xs last:border-b-0",
        bet.isMe &&
          "rounded-lg bg-[color-mix(in_oklab,var(--color-cyan)_8%,transparent)] px-1.5 ring-1 ring-[color-mix(in_oklab,var(--color-cyan)_40%,transparent)]",
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: GAME_ACCENT[bet.game] }}
        title={GAME_LABEL[bet.game]}
      />
      <span className="truncate text-(--color-muted)">
        {bet.isMe && (
          <span className="mr-1 rounded-sm bg-(--color-cyan) px-1 py-px text-[8px] font-bold text-(--color-bg-0)">
            ME
          </span>
        )}
        {bet.user}
        <span className="ml-1 text-[9px] uppercase text-muted-2">
          {bet.mode === "demo" ? "·데모" : ""}
        </span>
      </span>
      <span className="font-numeric w-16 text-right tabular-nums">{bet.amount.toFixed(2)}</span>
      <span
        className={cn(
          "font-numeric w-14 text-right tabular-nums",
          bet.status === "bust" ? "text-(--color-rose)" : "text-(--color-muted)",
        )}
      >
        {multText}
      </span>
      <span
        className="font-numeric w-16 text-right font-bold tabular-nums"
        style={{ color: profitColor }}
      >
        {profitText}
      </span>
    </li>
  );
}

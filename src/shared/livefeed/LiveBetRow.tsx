/**
 * LiveBetRow — single bet row used by both LiveBetsFeed (li list) and
 * LiveBetsVirtualList (react-window list). Memoized.
 */
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import type { LiveBet } from "./LiveBetsStore";

export const ROW_GRID =
  "grid grid-cols-[0.375rem_minmax(0,1fr)_5rem_3.25rem_5.5rem] items-center gap-x-2";

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
  bet: LiveBet;
  /** When rendered inside a react-window row container. */
  asDiv?: boolean;
  style?: CSSProperties;
}

function LiveBetRowImpl({ bet, asDiv, style }: Props) {
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

  const className = cn(
    ROW_GRID,
    "text-xs",
    bet.isMe
      ? "my-1 rounded-lg border-b-0 py-2.5 bg-[color-mix(in_oklab,var(--color-cyan)_8%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-cyan)_45%,transparent)]"
      : "border-b border-(--color-border) py-1.5 last:border-b-0",
  );

  const content = (
    <>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: GAME_ACCENT[bet.game] }}
        title={GAME_LABEL[bet.game]}
      />
      <span className="min-w-0 truncate text-(--color-muted)">
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
      <span className="font-numeric shrink-0 text-right tabular-nums">{bet.amount.toFixed(2)}</span>
      <span
        className={cn(
          "font-numeric shrink-0 text-right tabular-nums",
          bet.status === "bust" ? "font-semibold text-(--color-rose)" : "text-(--color-muted)",
        )}
      >
        {multText}
      </span>
      <span
        className="font-numeric shrink-0 text-right font-bold tabular-nums"
        style={{ color: profitColor }}
      >
        {profitText}
      </span>
    </>
  );

  if (asDiv) {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }
  return (
    <li className={className} style={style}>
      {content}
    </li>
  );
}

export const LiveBetRow = memo(LiveBetRowImpl);

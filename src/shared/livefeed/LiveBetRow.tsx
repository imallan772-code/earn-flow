/**
 * LiveBetRow — row used by LiveBetsFeed (li) and LiveBetsVirtualList (div).
 * ROUND P-PR2: ME left glow bar (absolute, ROW_GRID 0-diff) + win pulse.
 */
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import type { LiveBet } from "./LiveBetsStore";

export const ROW_GRID =
  "grid grid-cols-[0.375rem_minmax(0,1fr)_5rem_3.25rem_5.5rem] items-center gap-x-2";

const GAME_META: Record<LiveBet["game"], { label: string; accent: string }> = {
  crash: { label: "Crash", accent: "var(--color-cyan)" },
  dice: { label: "Dice", accent: "var(--color-emerald)" },
  plinko: { label: "Plinko", accent: "var(--color-gold)" },
  slots: { label: "Slots", accent: "var(--color-pink)" },
  mines: { label: "Mines", accent: "var(--color-warning)" },
  roulette: { label: "Roulette", accent: "var(--color-purple)" },
  limbo: { label: "Limbo", accent: "var(--color-purple)" },
  wheel: { label: "Wheel", accent: "var(--color-gold)" },
};

interface Props {
  bet: LiveBet;
  /** When rendered inside a react-window row container. */
  asDiv?: boolean;
  style?: CSSProperties;
}

function LiveBetRowImpl({ bet, asDiv, style }: Props) {
  const isPending = bet.status === "pending";
  const profitColor =
    bet.profit == null || isPending
      ? "var(--color-muted-2)"
      : bet.profit > 0
        ? "var(--color-emerald)"
        : "var(--color-rose)";
  const profitText = isPending
    ? "—"
    : bet.profit != null
      ? `${bet.profit > 0 ? "+" : ""}${bet.profit.toFixed(2)}`
      : "—";
  const multText =
    bet.multiplier != null && bet.multiplier > 0
      ? `${bet.multiplier.toFixed(2)}x`
      : bet.status === "bust"
        ? "BUST"
        : "—";
  const meWin = bet.isMe && (bet.status === "win" || bet.status === "cashout");

  const className = cn(
    ROW_GRID,
    "relative text-xs",
    bet.isMe
      ? "my-1 rounded-lg border-b-0 py-2.5 bg-[color-mix(in_oklab,var(--color-cyan)_8%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-cyan)_45%,transparent)]"
      : "border-b border-(--color-border) py-1.5 last:border-b-0",
    meWin && "live-row-me-win",
  );

  const content = (
    <>
      {bet.isMe && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 inset-y-0 w-[2px] rounded-r-sm bg-(--color-cyan) shadow-[0_0_6px_color-mix(in_oklab,var(--color-cyan)_70%,transparent)]"
        />
      )}
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: GAME_ACCENT[bet.game] }}
        title={GAME_LABEL[bet.game]}
      />
      <span className="min-w-0 truncate text-(--color-muted)">
        {bet.isMe && (
          <span className="mr-1 rounded-sm bg-(--color-cyan) px-1 py-px text-[8px] font-bold text-(--color-bg-0)">
            나
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

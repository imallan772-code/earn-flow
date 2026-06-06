/**
 * LiveBetsVirtualList — react-window v2 List wrapper for the live feed.
 *
 * Used by LiveBetsFeed when `virtualized` or `limit > 50`. Caps at 500 rows.
 * ME pinning is preserved because the caller passes already-ordered bets.
 */
import { List, type RowComponentProps } from "react-window";
import type { CSSProperties } from "react";
import { LiveBetRow } from "./LiveBetRow";
import type { LiveBet } from "./LiveBetsStore";

const ROW_HEIGHT = 32;
const MAX_ROWS = 500;

interface Props {
  bets: LiveBet[];
  height?: number;
}

interface RowExtra {
  bets: LiveBet[];
}

function Row({ index, style, bets }: RowComponentProps<RowExtra>) {
  const bet = bets[index];
  if (!bet) return null;
  return <LiveBetRow bet={bet} asDiv style={style as CSSProperties} />;
}

export function LiveBetsVirtualList({ bets, height = 360 }: Props) {
  const view = bets.slice(0, MAX_ROWS);
  if (view.length === 0) {
    return <div className="py-4 text-center text-[11px] text-muted-2">베팅 대기 중...</div>;
  }
  return (
    <List<RowExtra>
      rowComponent={Row}
      rowCount={view.length}
      rowHeight={ROW_HEIGHT}
      rowProps={{ bets: view }}
      overscanCount={6}
      style={{ height, width: "100%" }}
    />
  );
}

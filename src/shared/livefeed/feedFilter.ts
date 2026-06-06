/**
 * LiveBetsFeed filter derive — kept separate from the component file so
 * fast-refresh stays clean (react-refresh/only-export-components).
 */
import type { LiveBet } from "./LiveBetsStore";

export type FeedFilter = "all" | "big" | "me";

export const BIG_WIN_MULTIPLIER = 10;

export function applyFeedFilter(bets: LiveBet[], filter: FeedFilter): LiveBet[] {
  if (filter === "all") return bets;
  if (filter === "me") return bets.filter((b) => b.isMe === true);
  return bets.filter(
    (b) =>
      (b.status === "win" || b.status === "cashout") &&
      b.multiplier != null &&
      b.multiplier >= BIG_WIN_MULTIPLIER,
  );
}

/**
 * Map Supabase live_bets rows → LiveBetsStore shape (additive Realtime merge).
 */
import type { LiveBet, LiveGame, LiveStatus } from "@/shared/livefeed/LiveBetsStore";
import { ME_USER_LABEL } from "@/shared/livefeed/LiveBetsStore";
import type { LiveBetRow } from "./liveFeedSchemas";

const LIVE_GAMES = new Set<LiveGame>([
  "crash",
  "dice",
  "plinko",
  "slots",
  "mines",
  "roulette",
  "limbo",
  "wheel",
]);

function isLiveGame(value: string): value is LiveGame {
  return LIVE_GAMES.has(value as LiveGame);
}

export function liveFeedBetId(eventKey: string): string {
  return `live:${eventKey}`;
}

export function liveFeedBetIdForRound(game: string, roundId: string): string {
  return liveFeedBetId(`${game}:${roundId}`);
}

/** Convert DB row → store bet. Skips unknown games. */
export function mapLiveBetRow(row: LiveBetRow, currentUserId: string | null): LiveBet | null {
  if (!isLiveGame(row.game)) return null;

  const isMe =
    currentUserId !== null &&
    row.user_id !== undefined &&
    row.user_id === currentUserId;
  const status = row.status as LiveStatus;

  return {
    id: liveFeedBetId(row.event_key),
    user: isMe ? ME_USER_LABEL : row.display_name,
    game: row.game,
    amount: row.amount,
    multiplier: row.multiplier,
    profit: row.profit,
    status,
    mode: row.mode,
    ts: new Date(row.updated_at).getTime(),
    isMe: isMe || undefined,
  };
}

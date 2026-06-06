import type { LiveBet, LiveGame } from "./LiveBetsStore";
import { ME_USER_LABEL } from "./LiveBetsStore";

export function userLiveBetFallback(
  game: LiveGame,
  amount: number,
  mode: "demo" | "real",
): Omit<LiveBet, "id" | "ts"> {
  return {
    user: ME_USER_LABEL,
    game,
    amount,
    mode,
    isMe: true,
    multiplier: null,
    profit: null,
    status: "pending",
  };
}

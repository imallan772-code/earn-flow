/**
 * Bot bet generator — pushes synthetic bets at randomized intervals to
 * simulate global 24/7 activity. Started once, stopped on unmount.
 */
import { liveBetsStore, type LiveGame } from "./LiveBetsStore";
import { randomMaskedNick } from "./nicknames";

const GAMES: LiveGame[] = [
  "crash", "crash", "crash", "crash",
  "dice", "dice", "dice",
  "plinko", "plinko",
  "slots", "slots",
  "mines",
  "roulette",
];

function lognormalAmount(): number {
  const r = Math.random();
  if (r < 0.82) return 5 + Math.random() * 95;
  if (r < 0.96) return 100 + Math.random() * 400;
  return 500 + Math.random() * 2500;
}

function rollOutcome(game: LiveGame, amount: number) {
  // ~58% loss, 41% win, 1% jackpot
  const r = Math.random();
  const isJackpot = r > 0.99;
  const isWin = r > 0.58;
  if (!isWin && !isJackpot) {
    return {
      multiplier: null,
      profit: -amount,
      status: game === "crash" ? ("bust" as const) : ("loss" as const),
    };
  }
  const mult = isJackpot
    ? +(50 + Math.random() * 200).toFixed(2)
    : +(1.1 + Math.random() * 8).toFixed(2);
  return {
    multiplier: mult,
    profit: +(amount * (mult - 1)).toFixed(2),
    status: game === "crash" || game === "plinko" ? ("cashout" as const) : ("win" as const),
  };
}

let timer: number | null = null;
let refs = 0;

function tick() {
  const game = GAMES[Math.floor(Math.random() * GAMES.length)];
  const amount = +lognormalAmount().toFixed(2);
  const outcome = rollOutcome(game, amount);
  liveBetsStore.push({
    user: randomMaskedNick(),
    game,
    amount,
    ...outcome,
    mode: Math.random() < 0.82 ? "real" : "demo",
  });
  const nextDelay = 250 + Math.random() * 800;
  timer = window.setTimeout(tick, nextDelay);
}

/**
 * Start the bot loop. Reference-counted so multiple subscribers share one loop.
 * Returns a stop function.
 */
export function startBotFeed(): () => void {
  refs++;
  if (refs === 1 && timer === null) {
    timer = window.setTimeout(tick, 400);
  }
  return () => {
    refs = Math.max(0, refs - 1);
    if (refs === 0 && timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
}

/**
 * E2E betting browser init — isolated nonces per game/mode (no demo↔real idempotency clash).
 */
import type { GameName } from "../pages/game.page";
import type { BettingMode } from "./reset-betting-state";

export const GAME_STORAGE_KEYS: Record<GameName, string> = {
  dice: "phonara.gamestate.dice.v2",
  limbo: "phonara.gamestate.limbo.v2",
  crash: "phonara.gamestate.crash.v2",
  wheel: "phonara.gamestate.wheel.v1",
  plinko: "phonara.gamestate.plinko.v1",
  mines: "phonara.gamestate.mines.v1",
};

const NONCE_BASE: Record<GameName, { demo: number; real: number }> = {
  dice: { demo: 11_000, real: 811_000 },
  limbo: { demo: 21_000, real: 821_000 },
  crash: { demo: 31_000, real: 831_000 },
  wheel: { demo: 41_000, real: 841_000 },
  plinko: { demo: 51_000, real: 851_000 },
  mines: { demo: 61_000, real: 861_000 },
};

const RUN_NONCE_OFFSET = Math.floor(Date.now() % 100_000) * 100;

export function e2eNonceFor(game: GameName, mode: BettingMode, attempt: number): number {
  return NONCE_BASE[game][mode] + RUN_NONCE_OFFSET + attempt;
}

/** Minimal persisted state — matches createGameStore defaults (activeRound null). */
function minimalGameState(game: GameName, nonce: number): Record<string, unknown> {
  const clientSeed = "phonara-player-001";
  switch (game) {
    case "dice":
      return {
        nonce,
        history: [],
        lastRoll: null,
        lastOutcome: null,
        target: 50,
        diceMode: "over",
        pendingAmount: 10,
        clientSeed,
        activeRound: null,
      };
    case "limbo":
      return {
        nonce,
        history: [],
        lastOutcome: null,
        target: 2.0,
        pendingAmount: 10,
        activeRound: null,
        clientSeed,
        pendingLegacyRefunds: [],
      };
    case "crash":
      return {
        nonce,
        history: [],
        lastOutcome: null,
        pendingAmount: 10,
        // E2E: auto-cashout at 1.01x — avoids long running phase after manual cashout
        pendingTarget: 1.01,
        activeRound: null,
        clientSeed,
      };
    case "wheel":
      return {
        nonce,
        history: [],
        lastOutcome: null,
        risk: "medium",
        segments: 20,
        pendingAmount: 10,
        activeRound: null,
        clientSeed,
      };
    case "plinko":
      return {
        nonce,
        history: [],
        lastOutcome: null,
        rows: 16,
        risk: "medium",
        pendingAmount: 10,
      };
    case "mines":
      return {
        nonce,
        history: [],
        lastOutcome: null,
        mineCount: 3,
        pendingAmount: 10,
        activeRound: null,
        clientSeed,
      };
  }
}

/** Payload for page.addInitScript — runs before any app code on navigation. */
export function buildBettingInitPayload(
  game: GameName,
  mode: BettingMode,
  attempt: number,
): { mode: BettingMode; storageKey: string; stateJson: string } {
  const storageKey = GAME_STORAGE_KEYS[game];
  const nonce = e2eNonceFor(game, mode, attempt);
  return {
    mode,
    storageKey,
    stateJson: JSON.stringify(minimalGameState(game, nonce)),
  };
}

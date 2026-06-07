import {
  clearActiveSessionsForGame,
  ensureDemoMode,
  ensureRealMode,
  resetE2eBettingState,
  resetE2eRealBettingState,
  type SmokeGame,
} from "../../scripts/smoke-utils";
import { getE2eSupabase } from "./e2e-supabase";

export type BettingMode = "demo" | "real";

/** Per-game + mode prep (parallel E2E safe — only touches one game). */
export async function prepareGameBettingMode(
  game: SmokeGame,
  mode: BettingMode,
): Promise<void> {
  const client = await getE2eSupabase();
  await clearActiveSessionsForGame(client, game);
  if (mode === "real") {
    await ensureRealMode(client);
  } else {
    await ensureDemoMode(client);
  }
}

/** Full user reset (forensic preflight / serial). */
export async function prepareServerBettingMode(mode: BettingMode): Promise<{ cleared: number }> {
  const supabase = await getE2eSupabase();
  if (mode === "real") {
    return resetE2eRealBettingState(supabase);
  }
  return resetE2eBettingState(supabase);
}

/** Browser init: mode + wipe persisted game state. */
export function browserBettingInitScript(mode: BettingMode): void {
  localStorage.setItem("phonara.mode", mode);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("phonara.gamestate.")) {
      localStorage.removeItem(key);
    }
  }
}

/** @deprecated */
export async function resetServerBettingState(): Promise<void> {
  await prepareServerBettingMode("demo");
}

/** @deprecated */
export const CLEAR_GAME_STATE_INIT_SCRIPT = () => browserBettingInitScript("demo");

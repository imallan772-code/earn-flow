import {
  clearActiveSessionsForGame,
  clearPendingPlinkoQueue,
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
  if (game === "plinko") {
    const { data: userData } = await client.auth.getUser();
    const uid = userData.user?.id;
    if (uid) await clearPendingPlinkoQueue(uid);
  }
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

/** Browser init: mode + wipe all game localStorage (prefer buildBettingInitPayload for matrix). */
export function browserBettingInitScript(mode: BettingMode): void {
  localStorage.setItem("phonara.mode", mode);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("phonara.gamestate.")) {
      localStorage.removeItem(key);
    }
  }
}

/** Per-game server prep before a single matrix cell (serial E2E). */
export async function prepareGameForMatrixTest(
  game: SmokeGame,
  mode: BettingMode,
): Promise<void> {
  await prepareGameBettingMode(game, mode);
}

/** @deprecated */
export async function resetServerBettingState(): Promise<void> {
  await prepareServerBettingMode("demo");
}

/** @deprecated */
export const CLEAR_GAME_STATE_INIT_SCRIPT = () => browserBettingInitScript("demo");

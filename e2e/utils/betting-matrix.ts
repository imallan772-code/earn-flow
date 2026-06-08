/**
 * Shared betting matrix E2E helpers — serial, zero-tolerance hygiene.
 */
import { test, expect } from "../fixtures/authenticated";
import { GamePage, type GameName } from "../pages/game.page";
import { expectHealthyPage } from "../utils/assertions";
import {
  assertNoBlockingRpcFailures,
  rpcFailuresIncludeInsufficient,
} from "../utils/betting-assertions";
import { buildBettingInitPayload } from "../utils/betting-init";
import { attachConsoleErrorMonitor, attachRpcMonitor } from "../utils/rpc-monitor";
import { clearActiveSessionsForGame } from "../../scripts/smoke-utils";
import { getE2eSupabase } from "../utils/e2e-supabase";
import { prepareGameForMatrixTest, type BettingMode } from "../utils/reset-betting-state";

export const GAMES: { route: string; name: GameName }[] = [
  { route: "/games/dice", name: "dice" },
  { route: "/games/limbo", name: "limbo" },
  { route: "/games/crash", name: "crash" },
  { route: "/games/wheel", name: "wheel" },
  { route: "/games/plinko", name: "plinko" },
  { route: "/games/mines", name: "mines" },
];

export async function clearGameOnly(name: GameName) {
  const supabase = await getE2eSupabase();
  await clearActiveSessionsForGame(supabase, name);
}

export async function runBettingCase(
  page: import("@playwright/test").Page,
  route: string,
  name: GameName,
  mode: BettingMode,
  attempt = 1,
) {
  const rpc = attachRpcMonitor(page);
  const consoleMon = attachConsoleErrorMonitor(page);
  const game = new GamePage(page);

  try {
    await prepareGameForMatrixTest(name, mode);
    await clearGameOnly(name);

    const init = buildBettingInitPayload(name, mode, attempt);
    await page.addInitScript(
      (payload: { mode: string; storageKey: string; stateJson: string }) => {
        localStorage.setItem("phonara.mode", payload.mode);
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("phonara.gamestate.")) {
            localStorage.removeItem(key);
          }
        }
        localStorage.setItem(payload.storageKey, payload.stateJson);
      },
      init,
    );

    const response = await game.goto(route);
    expect(response?.status()).toBeLessThan(500);
    await expectHealthyPage(page);

    // Resume-First: let restored in-flight rounds finish (skip crash — betting window poll in placeBet)
    if (name !== "crash") {
      await game.waitForRoundIdle(mode, name).catch(() => undefined);
    }

    // Stale mid-round session: only when a real cashout control exists
    if (name === "crash" || name === "mines") {
      const cashout = game.cashoutButton().first();
      if (await cashout.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await game.completeGameRound(name, mode);
        await game.waitForRoundIdle(mode, name);
      }
    }

    await game.placeBetIfReady(name, mode);
    await game.waitForRoundActive(name, mode);
    await game.completeGameRound(name, mode);
    await game.waitForRoundIdle(mode, name);

    if (mode === "real" && rpcFailuresIncludeInsufficient(rpc.failures)) {
      test.skip(true, "insufficient PHON at bet time");
    }

    assertNoBlockingRpcFailures(rpc.failures);
    expect(consoleMon.errors, `console errors: ${consoleMon.errors.join("; ")}`).toHaveLength(0);
  } finally {
    rpc.dispose();
    consoleMon.dispose();
    await clearGameOnly(name).catch(() => undefined);
  }
}

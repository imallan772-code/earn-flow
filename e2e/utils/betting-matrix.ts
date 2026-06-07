/**
 * Shared betting matrix E2E helpers.
 */
import { test, expect } from "../fixtures/authenticated";
import { GamePage, type GameName } from "../pages/game.page";
import { expectHealthyPage } from "../utils/assertions";
import {
  assertNoBlockingRpcFailures,
  rpcFailuresIncludeInsufficient,
} from "../utils/betting-assertions";
import { attachConsoleErrorMonitor, attachRpcMonitor } from "../utils/rpc-monitor";
import { clearActiveSessionsForGame } from "../../scripts/smoke-utils";
import { getE2eSupabase } from "../utils/e2e-supabase";
import type { BettingMode } from "../utils/reset-betting-state";

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
) {
  const rpc = attachRpcMonitor(page);
  const consoleMon = attachConsoleErrorMonitor(page);
  const game = new GamePage(page);

  try {
    await clearGameOnly(name);
    await page.addInitScript((m: string) => {
      localStorage.setItem("phonara.mode", m);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("phonara.gamestate.")) {
          localStorage.removeItem(key);
        }
      }
    }, mode);

    const response = await game.goto(route);
    expect(response?.status()).toBeLessThan(500);
    await expectHealthyPage(page);
    await expect(game.betButton()).toBeVisible({ timeout: 20_000 });

    await game.placeBetIfReady(name, mode);
    await game.completeGameRound(name);

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

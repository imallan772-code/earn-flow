import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { BettingMode } from "../utils/reset-betting-state";

export type GameName = "dice" | "limbo" | "crash" | "wheel" | "plinko" | "mines";

const BET_READY_MS: Record<GameName, { demo: number; real: number }> = {
  dice: { demo: 12_000, real: 18_000 },
  limbo: { demo: 12_000, real: 18_000 },
  crash: { demo: 15_000, real: 22_000 },
  wheel: { demo: 12_000, real: 18_000 },
  plinko: { demo: 12_000, real: 18_000 },
  mines: { demo: 12_000, real: 18_000 },
};

export class GamePage {
  constructor(readonly page: Page) {}

  async goto(path: string) {
    return this.page.goto(path, { waitUntil: "domcontentloaded" });
  }

  betButton() {
    return this.page.getByRole("button", { name: "베팅", exact: true });
  }

  cashoutButton() {
    return this.page.getByRole("button", { name: /캐시아웃/i });
  }

  async placeBetIfReady(game: GameName = "dice", mode: BettingMode = "demo") {
    const timeout = BET_READY_MS[game][mode];
    const bet = this.betButton();
    await bet.waitFor({ state: "visible", timeout });
    await expect.poll(async () => bet.isEnabled(), { timeout, intervals: [200, 500, 1000] }).toBe(
      true,
    );
    await bet.click();
  }

  async placeDemoBetIfReady() {
    return this.placeBetIfReady();
  }

  async waitForBettingActive(timeoutMs = 12_000) {
    const patterns = [
      this.page.getByText(/라운드 진행 중/i).first(),
      this.page.getByText(/캐시아웃/i).first(),
      this.page.locator("canvas").first(),
      this.page.getByText(/배수|multiplier|×/i).first(),
    ];
    for (const loc of patterns) {
      try {
        await loc.waitFor({ state: "visible", timeout: timeoutMs / patterns.length });
        return;
      } catch {
        /* try next */
      }
    }
  }

  async completeGameRound(name: GameName) {
    if (name === "mines") {
      const tile = this.page.locator('[data-tile="0"]').first();
      if (await tile.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await tile.click();
      }
      const cashout = this.cashoutButton();
      if (await cashout.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await expect.poll(async () => cashout.isEnabled(), { timeout: 12_000 }).toBe(true);
        await cashout.click();
      }
      return;
    }

    if (name === "crash") {
      const cashout = this.cashoutButton();
      if (await cashout.isVisible({ timeout: 12_000 }).catch(() => false)) {
        await expect.poll(async () => cashout.isEnabled(), { timeout: 18_000 }).toBe(true);
        await cashout.click();
      }
      return;
    }

    await this.waitForBettingActive(10_000);
  }
}

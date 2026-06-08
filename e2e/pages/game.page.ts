import type { Page, Response } from "@playwright/test";
import { expect } from "@playwright/test";
import type { BettingMode } from "../utils/reset-betting-state";

export type GameName = "dice" | "limbo" | "crash" | "wheel" | "plinko" | "mines";

const BET_READY_MS: Record<GameName, { demo: number; real: number }> = {
  dice: { demo: 25_000, real: 28_000 },
  limbo: { demo: 15_000, real: 22_000 },
  crash: { demo: 22_000, real: 28_000 },
  wheel: { demo: 35_000, real: 40_000 },
  plinko: { demo: 16_000, real: 24_000 },
  mines: { demo: 25_000, real: 30_000 },
};

/** Max wait for round to return to idle (bet enabled). Keep tight — E2E budget ~90s/test. */
const ROUND_IDLE_MS: Record<GameName, { demo: number; real: number }> = {
  dice: { demo: 18_000, real: 22_000 },
  limbo: { demo: 18_000, real: 22_000 },
  crash: { demo: 65_000, real: 70_000 },
  wheel: { demo: 20_000, real: 24_000 },
  plinko: { demo: 28_000, real: 32_000 },
  mines: { demo: 28_000, real: 32_000 },
};

const CLICK_MS = 3_000;

export class GamePage {
  constructor(readonly page: Page) {}

  async goto(path: string) {
    return this.page.goto(path, { waitUntil: "domcontentloaded" });
  }

  betButton() {
    return this.page.getByTestId("stake-bet-submit");
  }

  cashoutButton() {
    return this.page.getByRole("button", { name: /캐(시|쉬)아웃/ });
  }

  private async bettingSnapshot(game: GameName, mode: BettingMode): Promise<string> {
    const bet = this.betButton();
    const inProgress = this.page.getByRole("button", { name: /라운드 진행 중/ });
    const cashout = this.cashoutButton().first();
    const parts = await Promise.all([
      bet.isVisible().catch(() => false),
      bet.isEnabled().catch(() => false),
      bet.textContent().catch(() => null),
      inProgress.isVisible().catch(() => false),
      cashout.isVisible().catch(() => false),
    ]);
    const [betVisible, betEnabled, betText, inProgressVisible, cashoutVisible] = parts;
    return JSON.stringify({
      game,
      mode,
      url: this.page.url(),
      betVisible,
      betEnabled,
      betText: betText?.trim() ?? null,
      inProgressVisible,
      cashoutVisible,
    });
  }

  async waitForRoundIdle(mode: BettingMode = "demo", game: GameName = "dice") {
    const timeout = ROUND_IDLE_MS[game][mode];
    const bet = this.betButton();
    const inProgress = this.page.getByRole("button", { name: /라운드 진행 중/ });
    await expect
      .poll(
        async () => {
          if (await inProgress.isVisible().catch(() => false)) return false;
          if (!(await bet.isVisible().catch(() => false))) return false;
          return bet.isEnabled().catch(() => false);
        },
        { timeout, intervals: [300, 500, 1000] },
      )
      .toBe(true);
  }

  async waitForRoundActive(name: GameName, mode: BettingMode = "demo") {
    if (name === "mines") {
      const timeout = mode === "real" ? 35_000 : 22_000;
      const randomBtn = this.page.getByRole("button", { name: "랜덤 안전 타일 1개 선택" });
      const inProgress = this.page.getByRole("button", { name: "라운드 진행 중", exact: true });
      const active = await expect
        .poll(
          async () => {
            if (await randomBtn.isVisible().catch(() => false)) return true;
            if (await inProgress.isVisible().catch(() => false)) return true;
            const tile0 = this.page.locator('[data-tile="0"] button');
            return (
              (await tile0.isVisible().catch(() => false)) &&
              (await tile0.isEnabled().catch(() => false))
            );
          },
          { timeout, intervals: [300, 500, 800, 1200] },
        )
        .toBe(true)
        .then(() => true)
        .catch(() => false);
      if (!active) {
        const tile0 = this.page.locator('[data-tile="0"] button');
        const randomVisible = await randomBtn.isVisible().catch(() => false);
        const tileVisible = await tile0.isVisible().catch(() => false);
        const tileEnabled = await tile0.isEnabled().catch(() => false);
        throw new Error(
          `mines round did not become active: ${await this.bettingSnapshot(name, mode)}; ${JSON.stringify({
            randomVisible,
            tileVisible,
            tileEnabled,
          })}`,
        );
      }
      return;
    }
    if (name === "crash") {
      const cashout = this.cashoutButton().first();
      const sawCashout = await cashout
        .waitFor({ state: "visible", timeout: 18_000 })
        .then(() => true)
        .catch(() => false);
      if (!sawCashout) {
        const inProgress = this.page.getByRole("button", { name: /라운드 진행 중/ });
        await expect(inProgress.first()).toBeVisible({ timeout: 12_000 });
      }
      return;
    }
    await this.waitForBettingActive(12_000);
  }

  async placeBetIfReady(game: GameName = "dice", mode: BettingMode = "demo") {
    const timeout = BET_READY_MS[game][mode];
    const bet = this.betButton();
    const inProgress = this.page.getByRole("button", { name: /라운드 진행 중/ });
    const cashout = this.cashoutButton().first();
    if (game === "mines" && (await cashout.isVisible({ timeout: 1_000 }).catch(() => false))) {
      await this.completeGameRound(game, mode);
      await this.waitForRoundIdle(mode, game);
    }
    const ready = await expect
      .poll(
        async () => {
          if (await inProgress.isVisible().catch(() => false)) return false;
          if (!(await bet.isVisible().catch(() => false))) return false;
          return bet.isEnabled().catch(() => false);
        },
        { timeout, intervals: [200, 400, 800, 1200] },
      )
      .toBe(true)
      .then(() => true)
      .catch(() => false);
    if (!ready) {
      throw new Error(`bet button did not become ready: ${await this.bettingSnapshot(game, mode)}`);
    }

    const clickTimeout = game === "crash" ? 15_000 : 8_000;
    let minesStart: Promise<Response> | null = null;
    let lastClickError: unknown = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await bet.isEnabled().catch(() => false))) {
        await this.page.waitForTimeout(150);
        continue;
      }
      try {
        const startResponse =
          game === "mines" && mode === "real"
            ? this.page.waitForResponse(
                (res) =>
                  res.request().method() === "POST" && res.url().includes("mines_start_round_v1"),
                {
                  timeout: 35_000,
                },
              )
            : null;
        await bet.click({ timeout: Math.min(clickTimeout, 4_000) });
        minesStart = startResponse;
        break;
      } catch (err) {
        lastClickError = err;
        minesStart?.catch(() => undefined);
        minesStart = null;
        if (attempt === 4) {
          throw new Error(
            `bet click failed after retries: ${await this.bettingSnapshot(game, mode)}; ${String(lastClickError)}`,
          );
        }
      }
    }

    if (minesStart) {
      const response = await minesStart.catch(async (err) => {
        const text = await bet.textContent().catch(() => "(unreadable button)");
        throw new Error(
          `mines_start_round_v1 did not respond after bet click; button="${text?.trim()}"; ${String(err)}`,
        );
      });
      if (response.status() >= 400) {
        const body = await response.text().catch(() => "(unreadable body)");
        throw new Error(`mines_start_round_v1 failed: ${response.status()} ${body.slice(0, 500)}`);
      }
    }
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

  async completeGameRound(name: GameName, mode: BettingMode = "demo") {
    if (name === "mines") {
      const randomBtn = this.page.getByRole("button", { name: "랜덤 안전 타일 1개 선택" });
      if (await randomBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await randomBtn.click({ timeout: 8_000 });
      }
      const cashout = this.cashoutButton().first();
      await expect
        .poll(
          async () => {
            const cashoutReady =
              (await cashout.isVisible().catch(() => false)) &&
              (await cashout.isEnabled().catch(() => false));
            const betReady =
              (await this.betButton().isVisible().catch(() => false)) &&
              (await this.betButton().isEnabled().catch(() => false));
            return cashoutReady || betReady;
          },
          { timeout: 20_000, intervals: [300, 500, 800] },
        )
        .toBe(true);
      if (await cashout.isEnabled().catch(() => false)) {
        await cashout.click({ timeout: 8_000, force: true });
      }
      return;
    }

    if (name === "crash") {
      const cashout = this.cashoutButton().first();
      if (await cashout.isVisible({ timeout: 8_000 }).catch(() => false)) {
        if (await cashout.isEnabled().catch(() => false)) {
          await cashout.click({ timeout: 8_000, force: true });
        }
      }
      await this.waitForRoundIdle(mode, "crash");
      return;
    }

    if (name === "plinko") {
      await this.waitForBettingActive(6_000);
      return;
    }

    await this.waitForBettingActive(6_000);
  }
}

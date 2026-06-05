import { test, expect } from "../fixtures/authenticated";
import { AppShell } from "../pages/app.page";
import { GamePage } from "../pages/game.page";
import { expectHealthyPage } from "../utils/assertions";
import { GAME_ROUTES } from "../utils/routes";
import { areE2eCredentialsValid } from "../utils/supabase-auth";

test.beforeEach(async ({ page }) => {
  test.skip(
    !(await areE2eCredentialsValid()),
    "Set valid E2E_USER_EMAIL and E2E_USER_PASSWORD in .env",
  );
  await page.addInitScript(() => {
    localStorage.setItem("phonara.mode", "demo");
  });
});

test.describe("Game screens", () => {
  for (const route of GAME_ROUTES) {
    test(`${route} loads bet panel`, async ({ page }) => {
      const game = new GamePage(page);
      const response = await game.goto(route);
      expect(response?.status()).toBeLessThan(500);
      await expectHealthyPage(page);
      await expect(game.betButton()).toBeVisible();
    });
  }

  test("mines demo bet starts a round", async ({ page }) => {
    const app = new AppShell(page);
    const game = new GamePage(page);
    await app.ensureDemoMode();
    await game.goto("/games/mines");
    await expectHealthyPage(page);

    await game.placeDemoBetIfReady();
    await expect(page.getByText(/라운드 진행 중|캐시아웃/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

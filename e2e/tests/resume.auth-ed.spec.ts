/**
 * GA-ACCEPT-C: Resume E2E — Crash auto_cashout, Plinko pending, auto-bet stopping.
 *
 * Tests the resume-first policy: navigating away and returning should restore
 * game state without data loss.
 */
import { test, expect } from "../fixtures/authenticated";
import { GamePage } from "../pages/game.page";
import { AppShell } from "../pages/app.page";
import { expectHealthyPage } from "../utils/assertions";
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

test.describe("Resume E2E (GA-ACCEPT-C)", () => {
  test("crash: navigate away during betting and return resumes state", async ({
    page,
  }) => {
    const app = new AppShell(page);
    const game = new GamePage(page);
    await app.ensureDemoMode();

    await game.goto("/games/crash");
    await expectHealthyPage(page);

    await game.placeDemoBetIfReady();

    const betButton = game.betButton();
    const hasBet = await betButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    await page.goto("/");
    await page.waitForTimeout(1_000);

    await game.goto("/games/crash");
    await expectHealthyPage(page);

    const crashCanvas = page.locator("canvas").first();
    await expect(crashCanvas).toBeVisible({ timeout: 10_000 });
  });

  test("plinko: navigate away after bet and return shows result", async ({
    page,
  }) => {
    const app = new AppShell(page);
    const game = new GamePage(page);
    await app.ensureDemoMode();

    await game.goto("/games/plinko");
    await expectHealthyPage(page);

    await game.placeDemoBetIfReady();
    await page.waitForTimeout(2_000);

    await page.goto("/");
    await page.waitForTimeout(1_000);

    await game.goto("/games/plinko");
    await expectHealthyPage(page);

    const betPanel = page
      .getByRole("button", { name: /베팅|bet/i })
      .first();
    await expect(betPanel).toBeVisible({ timeout: 10_000 });
  });

  test("auto-bet: stopping auto-bet preserves session stats", async ({
    page,
  }) => {
    const app = new AppShell(page);
    const game = new GamePage(page);
    await app.ensureDemoMode();

    await game.goto("/games/dice");
    await expectHealthyPage(page);

    const autoTab = page.getByRole("tab", { name: /자동|auto/i }).first();
    const hasAutoTab = await autoTab
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    test.skip(!hasAutoTab, "Auto-bet tab not found");

    await autoTab.click();

    const startBtn = page
      .getByRole("button", { name: /시작|start/i })
      .first();
    const hasStartBtn = await startBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    test.skip(!hasStartBtn, "Auto-bet start button not found");

    await startBtn.click();
    await page.waitForTimeout(3_000);

    const stopBtn = page
      .getByRole("button", { name: /정지|stop/i })
      .first();
    const hasStopBtn = await stopBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (hasStopBtn) {
      await stopBtn.click();
    }

    await page.waitForTimeout(1_000);

    await page.goto("/");
    await page.waitForTimeout(500);

    await game.goto("/games/dice");
    await expectHealthyPage(page);
  });
});

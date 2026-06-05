import { test, expect } from "../fixtures/authenticated";
import { AppShell } from "../pages/app.page";
import { expectHealthyPage } from "../utils/assertions";
import { APP_ROUTES } from "../utils/routes";
import { areE2eCredentialsValid } from "../utils/supabase-auth";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  test.skip(
    !(await areE2eCredentialsValid()),
    "Set valid E2E_USER_EMAIL and E2E_USER_PASSWORD in .env",
  );
  await page.addInitScript(() => {
    localStorage.setItem("phonara.mode", "demo");
  });
});

test.describe("Authenticated app shell", () => {
  test("bottom nav navigates core tabs", async ({ page }) => {
    const app = new AppShell(page);
    await app.gotoFeed();
    await expectHealthyPage(page);
    await expect(app.navFeed()).toBeVisible();

    await app.navEarn().click();
    await expect(page).toHaveURL(/\/earn/);
    await expect(page.getByText("오늘의 미션")).toBeVisible();

    await app.navMy().click();
    await expect(page).toHaveURL(/\/my/);

    await app.navNotice().click();
    await expect(page).toHaveURL(/\/notice/);
  });

  for (const route of APP_ROUTES) {
    test(`GET ${route} → healthy`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(500);
      await expectHealthyPage(page);
    });
  }
});

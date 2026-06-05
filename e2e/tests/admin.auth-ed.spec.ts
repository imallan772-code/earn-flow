import { test, expect } from "../fixtures/authenticated";
import { AdminPage } from "../pages/admin.page";
import { expectHealthyPage } from "../utils/assertions";
import { ADMIN_ROUTES } from "../utils/routes";
import { areE2eCredentialsValid } from "../utils/supabase-auth";

test.beforeEach(async () => {
  test.skip(
    !(await areE2eCredentialsValid()),
    "Set valid E2E_USER_EMAIL and E2E_USER_PASSWORD in .env",
  );
});

test.describe("Admin console", () => {
  test("dashboard loads for admin user", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.gotoDashboard();

    await expect(admin.spinner()).toHaveCount(0, { timeout: 30_000 });
    await expect(admin.deniedHeading()).toHaveCount(0);
    await expect(admin.dashboardHeading()).toBeVisible({ timeout: 30_000 });
    await expectHealthyPage(page);
  });

  for (const route of ADMIN_ROUTES) {
    test(`GET ${route} → not denied`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.getByRole("heading", { name: "운영 콘솔 접근 불가" })).toHaveCount(0);
      await expectHealthyPage(page);
    });
  }
});

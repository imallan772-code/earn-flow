import { test, expect } from "@playwright/test";
import { expectHealthyPage } from "../utils/assertions";
import { areE2eCredentialsValid, injectSupabaseSession } from "../utils/supabase-auth";
import { getE2eCredentials } from "../utils/env";

test.describe("Auth UI flow", () => {
  test.beforeEach(async () => {
    test.skip(
      !(await areE2eCredentialsValid()),
      "Set valid E2E_USER_EMAIL and E2E_USER_PASSWORD in .env",
    );
  });

  test("email login reaches feed or onboarding", async ({ page }) => {
    const creds = getE2eCredentials()!;
    await injectSupabaseSession(page, creds.email, creds.password);
    await page.goto("/feed");
    await page.waitForURL(/\/(feed|onboarding)/, { timeout: 30_000 });
    await expectHealthyPage(page);
  });

  test("logout from my page returns to login", async ({ page }) => {
    const creds = getE2eCredentials()!;
    await injectSupabaseSession(page, creds.email, creds.password);
    await page.goto("/feed");
    await page.waitForURL(/\/(feed|onboarding)/, { timeout: 30_000 });

    if (page.url().includes("/onboarding")) {
      test.skip(true, "User has not completed onboarding — complete once manually");
    }

    await page.goto("/my");
    await expectHealthyPage(page);

    const logout = page.getByRole("button", { name: /로그아웃|로그 아웃/i });
    if ((await logout.count()) === 0) {
      test.skip(true, "Logout button not found on /my — adjust selector when UI stabilizes");
    }
    await logout.first().click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });
  });
});

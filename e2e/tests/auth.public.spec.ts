import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { expectHealthyPage } from "../utils/assertions";
import { areE2eCredentialsValid, injectSupabaseSession, navigateAuthenticated } from "../utils/supabase-auth";
import { getE2eCredentials } from "../utils/env";

const authFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.auth/user.json");

test.describe("Auth UI flow", () => {
  test.beforeEach(async () => {
    test.skip(
      !(await areE2eCredentialsValid()),
      "Set valid E2E_USER_EMAIL and E2E_USER_PASSWORD in .env",
    );
  });

  test("email login reaches feed or onboarding", async ({ page }) => {
    test.setTimeout(90_000);
    const creds = getE2eCredentials()!;
    await injectSupabaseSession(page, creds.email, creds.password);
    await navigateAuthenticated(page, "/feed", /\/(feed|onboarding|earn)/);
    await expectHealthyPage(page);
  });

  test.describe("logout with saved session", () => {
    test.use({ storageState: authFile });

    test("logout from my page returns to login", async ({ page }) => {
      await navigateAuthenticated(page, "/my", /\/my/);
      await expectHealthyPage(page);

      const logout = page.getByRole("button", { name: /로그아웃/i });
      await expect(logout).toBeVisible();
      await logout.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    });
  });
});

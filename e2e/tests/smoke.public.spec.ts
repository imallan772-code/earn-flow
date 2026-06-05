import { test, expect } from "@playwright/test";
import { LandingPage } from "../pages/landing.page";
import { AuthPage } from "../pages/auth.page";
import { expectHealthyPage } from "../utils/assertions";
import { PUBLIC_ROUTES, MONEY_ROUTES } from "../utils/routes";
import { getEnv } from "../utils/env";

test.describe("Public smoke", () => {
  test("landing renders hero and CTAs", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await expectHealthyPage(page);
    await expect(landing.brand()).toBeVisible();
    await expect(landing.signupLink()).toBeVisible();
    await expect(landing.loginLink()).toBeVisible();
  });

  test("login and signup pages load", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await expectHealthyPage(page);
    await expect(page.getByRole("heading", { name: /로그인해서/ })).toBeVisible();

    await auth.gotoSignup();
    await expectHealthyPage(page);
    await expect(page.getByRole("heading", { name: /3초 만에/ })).toBeVisible();
  });

  for (const route of PUBLIC_ROUTES) {
    test(`GET ${route} → healthy SSR`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status(), `${route} should not 5xx`).toBeLessThan(500);
      await expectHealthyPage(page);
    });
  }

  for (const route of MONEY_ROUTES) {
    test(`GET ${route} → no crash`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status(), `${route} should not 5xx`).toBeLessThan(500);
      await expectHealthyPage(page);
    });
  }
});

test.describe("Auth guard (unauthenticated)", () => {
  test("protected app routes redirect to login when Supabase configured", async ({ page }) => {
    test.skip(
      !getEnv("VITE_SUPABASE_URL"),
      "Requires VITE_SUPABASE_URL — copy .env.example to .env",
    );

    await page.goto("/earn");
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /로그인해서/ })).toBeVisible();
  });
});

import { test as setup } from "@playwright/test";
import { areE2eCredentialsValid, saveAuthenticatedStorageState } from "../utils/supabase-auth";
import { getE2eCredentials } from "../utils/env";

const authFile = "e2e/.auth/user.json";

setup("authenticate test user", async ({ page }) => {
  setup.skip(
    !(await areE2eCredentialsValid()),
    "Set valid E2E_USER_EMAIL and E2E_USER_PASSWORD in .env",
  );

  const creds = getE2eCredentials()!;

  await saveAuthenticatedStorageState(page, creds.email, creds.password, authFile);
});

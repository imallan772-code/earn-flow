import { test as base } from "@playwright/test";
import { areE2eCredentialsValid, injectSupabaseSession } from "../utils/supabase-auth";
import { getE2eCredentials } from "../utils/env";

export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    const creds = getE2eCredentials();
    if (await areE2eCredentialsValid()) {
      await injectSupabaseSession(page, creds!.email, creds!.password);
    }
    await runWithPage(page);
  },
});

export { expect } from "@playwright/test";

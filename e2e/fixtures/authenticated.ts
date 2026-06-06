import { test as base } from "@playwright/test";
import { ensureAuthenticatedPage } from "../utils/supabase-auth";

export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    await ensureAuthenticatedPage(page);
    await runWithPage(page);
  },
});

export { expect } from "@playwright/test";

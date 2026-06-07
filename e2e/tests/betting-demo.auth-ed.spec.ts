import { test } from "../fixtures/authenticated";
import { GAMES, runBettingCase } from "../utils/betting-matrix";
import { prepareServerBettingMode } from "../utils/reset-betting-state";
import { areE2eCredentialsValid } from "../utils/supabase-auth";

test.beforeAll(async () => {
  test.skip(
    !(await areE2eCredentialsValid()),
    "Set valid E2E_USER_EMAIL and E2E_USER_PASSWORD in .env",
  );
  await prepareServerBettingMode("demo");
});

for (const { route, name } of GAMES) {
  test(`${name}: demo UI bet`, async ({ page }) => {
    await runBettingCase(page, route, name, "demo");
  });
}

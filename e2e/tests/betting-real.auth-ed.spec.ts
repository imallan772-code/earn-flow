import { test } from "../fixtures/authenticated";
import { GAMES, runBettingCase } from "../utils/betting-matrix";
import { getE2ePhonBalance, hasRealBettingBalance, REAL_MIN_PHON } from "../utils/e2e-wallet";
import { prepareServerBettingMode } from "../utils/reset-betting-state";
import { areE2eCredentialsValid } from "../utils/supabase-auth";

test.beforeAll(async () => {
  test.skip(
    !(await areE2eCredentialsValid()),
    "Set valid E2E_USER_EMAIL and E2E_USER_PASSWORD in .env",
  );
  const phon = await getE2ePhonBalance().catch(() => 0);
  test.skip(!hasRealBettingBalance(phon), `E2E user needs ≥${REAL_MIN_PHON} PHON (balance=${phon})`);
  await prepareServerBettingMode("real");
});

for (const { route, name } of GAMES) {
  test(`${name}: real UI bet`, async ({ page }) => {
    await runBettingCase(page, route, name, "real");
  });
}

test.afterAll(async () => {
  await prepareServerBettingMode("demo").catch(() => undefined);
});

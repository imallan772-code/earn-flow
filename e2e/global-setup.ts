/**
 * Playwright global setup — validate E2E credentials before any test runs.
 * Uses getE2eCredentials() (dotenv.parse), never process.env secrets.
 */
import { getE2eCredentials, hasE2eCredentials, warnIfProcessEnvMangled } from "./utils/env";
import { signInViaSupabase } from "./utils/supabase-auth";

export default async function globalSetup() {
  warnIfProcessEnvMangled();

  if (!hasE2eCredentials()) {
    console.log("[e2e] No E2E_USER_* in .env — authenticated suites skipped.");
    return;
  }

  const creds = getE2eCredentials()!;
  try {
    await signInViaSupabase(creds.email, creds.password);
    console.log("[e2e] Supabase sign-in OK for", creds.email);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[e2e] Supabase sign-in failed: ${message}\n` +
        "Fix E2E_USER_EMAIL / E2E_USER_PASSWORD in .env (use quotes if password contains $).\n" +
        "Verify: bun run test:e2e:verify-creds",
    );
  }
}

#!/usr/bin/env bun
/**
 * Official E2E credential check — do NOT use process.env.E2E_USER_PASSWORD in ad-hoc scripts.
 * Bun mangles `$` / `$$` in .env when loading into process.env.
 */
import { getE2eCredentials, hasE2eCredentials, warnIfProcessEnvMangled } from "../e2e/utils/env";
import { signInViaSupabase } from "../e2e/utils/supabase-auth";

warnIfProcessEnvMangled();

if (!hasE2eCredentials()) {
  console.error("Missing E2E_USER_EMAIL or E2E_USER_PASSWORD in .env — see .env.example");
  process.exit(1);
}

const creds = getE2eCredentials()!;
console.log("email:", creds.email);
console.log("password length (from .env file parse):", creds.password.length);

try {
  await signInViaSupabase(creds.email, creds.password);
  console.log("Supabase signInWithPassword: OK");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Supabase signInWithPassword: FAIL —", message);
  process.exit(1);
}

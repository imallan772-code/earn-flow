import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { getE2eCredentials, getSupabaseStorageKey, hasE2eCredentials, requireEnv } from "./env";

let e2eCredsValid: boolean | null = null;

/** Cached check — skips E2E auth suites when .env password is missing or wrong. */
export async function areE2eCredentialsValid(): Promise<boolean> {
  if (e2eCredsValid !== null) return e2eCredsValid;
  if (!hasE2eCredentials()) {
    e2eCredsValid = false;
    return false;
  }
  const creds = getE2eCredentials()!;
  try {
    await signInViaSupabase(creds.email, creds.password);
    e2eCredsValid = true;
  } catch {
    e2eCredsValid = false;
  }
  return e2eCredsValid;
}

export async function signInViaSupabase(email: string, password: string) {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("signInWithPassword returned no session");
  return { url, session: data.session };
}

export async function injectSupabaseSession(page: Page, email: string, password: string) {
  const { url, session } = await signInViaSupabase(email, password);
  const storageKey = getSupabaseStorageKey(url);

  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: session },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
}

export async function saveAuthenticatedStorageState(
  page: Page,
  email: string,
  password: string,
  authFile: string,
) {
  await injectSupabaseSession(page, email, password);

  await page.goto("/feed");
  await page.waitForURL(/\/feed/, { timeout: 30_000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
}

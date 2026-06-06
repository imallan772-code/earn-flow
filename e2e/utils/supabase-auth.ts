import fs from "node:fs";
import path from "node:path";
import { createClient, type Session } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { getE2eCredentials, getSupabaseStorageKey, hasE2eCredentials, requireEnv } from "./env";

let e2eCredsValid: boolean | null = null;
let cachedSession: { url: string; session: Session } | null = null;

const AUTH_ROUTE = /\/(feed|onboarding|my|earn)/;

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
  if (cachedSession) return cachedSession;

  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("signInWithPassword returned no session");

  cachedSession = { url, session: data.session };
  return cachedSession;
}

async function waitForSessionToken(page: Page, storageKey: string, timeout = 15_000) {
  await page.waitForFunction(
    (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { access_token?: string };
        return Boolean(parsed.access_token);
      } catch {
        return false;
      }
    },
    storageKey,
    { timeout },
  );
}

/** Inject Supabase session into browser localStorage (one API sign-in per worker). */
export async function injectSupabaseSession(page: Page, email: string, password: string) {
  const { url, session } = await signInViaSupabase(email, password);
  const storageKey = getSupabaseStorageKey(url);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: session },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForSessionToken(page, storageKey);
}

/** Ensure page has a Supabase token — inject only when storageState is missing or stale. */
export async function ensureAuthenticatedPage(page: Page) {
  const creds = getE2eCredentials();
  if (!creds || !(await areE2eCredentialsValid())) return;

  const url = requireEnv("VITE_SUPABASE_URL");
  const storageKey = getSupabaseStorageKey(url);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hasToken = await page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      return Boolean((JSON.parse(raw) as { access_token?: string }).access_token);
    } catch {
      return false;
    }
  }, storageKey);

  if (!hasToken) {
    await injectSupabaseSession(page, creds.email, creds.password);
  } else {
    await waitForSessionToken(page, storageKey);
  }
}

/**
 * Navigate to a protected route after AuthContext hydrates.
 * Retries reload + navigation when a race sends us to /login.
 */
export async function navigateAuthenticated(
  page: Page,
  path: string,
  expectedUrl: RegExp = AUTH_ROUTE,
) {
  await expect(async () => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const href = page.url();
    if (expectedUrl.test(href)) return;
    if (href.includes("/login") || href.includes("/signup")) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.goto(path, { waitUntil: "domcontentloaded" });
    }
    expect(page.url()).toMatch(expectedUrl);
  }).toPass({ timeout: 45_000, intervals: [500, 1_000, 2_000, 3_000] });
}

export async function saveAuthenticatedStorageState(
  page: Page,
  email: string,
  password: string,
  authFile: string,
) {
  await injectSupabaseSession(page, email, password);
  await navigateAuthenticated(page, "/my", /\/my/);

  if (page.url().includes("/onboarding")) {
    throw new Error(
      "E2E user has not completed onboarding — run: bun run test:e2e:complete-onboarding",
    );
  }
  if (page.url().includes("/login")) {
    throw new Error("E2E session inject failed — check credentials and Supabase config");
  }

  const resolved = path.resolve(authFile);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  await page.context().storageState({ path: resolved });
}

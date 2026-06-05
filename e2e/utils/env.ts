import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

let fileEnv: Record<string, string> | null = null;

/**
 * Read `.env` with dotenv.parse. Bun pre-loads `.env` into process.env but mangles
 * values containing `$` (e.g. `$$` in passwords). E2E must use the parsed file.
 */
function envFromFile(): Record<string, string> {
  if (fileEnv) return fileEnv;
  const envPath = path.resolve(rootDir, ".env");
  fileEnv = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath, "utf8")) : {};
  return fileEnv;
}

export function getEnv(name: string): string | undefined {
  return envFromFile()[name] ?? process.env[name];
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing ${name} — see .env.example E2E section`);
  return value;
}

const PLACEHOLDER_PASSWORDS = new Set(["your-account-password", "changeme", "password"]);

/** Keys that must be read via getEnv() — Bun may corrupt them in process.env. */
const FILE_ENV_SECRET_KEYS = [
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

/** Warn when Bun's process.env differs from .env file (common with `$` in passwords). */
export function warnIfProcessEnvMangled(): void {
  const file = envFromFile();
  for (const key of FILE_ENV_SECRET_KEYS) {
    const fromFile = file[key];
    const fromProcess = process.env[key];
    if (!fromFile || !fromProcess || fromFile === fromProcess) continue;
    console.warn(
      `[e2e/env] process.env.${key} differs from .env file (Bun strips $ in values). ` +
        "E2E uses getEnv() from file — OK. Do not use process.env for E2E secrets.",
    );
  }
}

export function getE2eCredentials(): { email: string; password: string } | null {
  const email = getEnv("E2E_USER_EMAIL");
  const password = getEnv("E2E_USER_PASSWORD");
  if (!email || !password) return null;
  if (PLACEHOLDER_PASSWORDS.has(password)) return null;
  return { email, password };
}

export function hasE2eCredentials(): boolean {
  return getE2eCredentials() != null;
}

export function getE2eBaseUrl(): string {
  return getEnv("E2E_BASE_URL") ?? "http://localhost:8080";
}

export function getSupabaseProjectRef(url: string): string {
  return new URL(url).hostname.split(".")[0];
}

export function getSupabaseStorageKey(url: string): string {
  return `sb-${getSupabaseProjectRef(url)}-auth-token`;
}

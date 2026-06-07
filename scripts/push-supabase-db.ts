#!/usr/bin/env bun
/**
 * Push pending SQL migrations to phonara-gb (kanftnqenuzverroodev).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:db:push
 *
 * Token: https://supabase.com/dashboard/account/tokens
 * Falls back to `supabase login` session when token unset.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const PROJECT_REF = "kanftnqenuzverroodev";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(): Record<string, string> {
  const envPath = path.join(rootDir, ".env");
  return fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath, "utf8")) : {};
}

const fileEnv = loadEnv();
const token = (fileEnv.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN)?.trim();

async function pushViaCli() {
  const env = { ...process.env } as Record<string, string>;
  if (token) env.SUPABASE_ACCESS_TOKEN = token;

  const link = Bun.spawn(
    ["supabase", "link", "--project-ref", PROJECT_REF, "--yes"],
    { stdout: "inherit", stderr: "inherit", env },
  );
  const linkCode = await link.exited;
  if (linkCode !== 0) {
    throw new Error(`supabase link exited with ${linkCode}`);
  }

  const push = Bun.spawn(["supabase", "db", "push", "--yes"], {
    stdout: "inherit",
    stderr: "inherit",
    env,
  });
  const pushCode = await push.exited;
  if (pushCode !== 0) {
    throw new Error(`supabase db push exited with ${pushCode}`);
  }

  console.log("✓ Database migrations pushed");
}

try {
  if (!token) {
    console.log("SUPABASE_ACCESS_TOKEN not set — trying Supabase CLI login session…");
  }
  await pushViaCli();
} catch (err) {
  console.error("\n✗ Database push failed.");
  console.error(err instanceof Error ? err.message : err);
  console.error("\nFix: create a token at https://supabase.com/dashboard/account/tokens");
  console.error("Then: SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:db:push");
  process.exit(1);
}

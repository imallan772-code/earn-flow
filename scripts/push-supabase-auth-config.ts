/**
 * Push auth settings to phonara-gb via Supabase Management API.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:config:push
 *
 * Part 5 security only:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:auth:part5
 *
 * Token: https://supabase.com/dashboard/account/tokens
 * Falls back to `supabase config push` when the CLI is logged in.
 */
import { AUTH_DEV_BASE } from "./auth-config/part5-security";

const PROJECT_REF = "kanftnqenuzverroodev";

const AUTH_PATCH = { ...AUTH_DEV_BASE } as const;

async function pushViaManagementApi(token: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(AUTH_PATCH),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Management API ${res.status}: ${body}`);
  }

  console.log("✓ Auth config pushed via Management API");
  console.log(JSON.stringify(await res.json(), null, 2));
}

async function pushViaCli() {
  const proc = Bun.spawn(["supabase", "config", "push", "--yes", "--project-ref", PROJECT_REF], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`supabase config push exited with ${code}`);
  }
  console.log("✓ Auth config pushed via Supabase CLI");
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

try {
  if (token) {
    await pushViaManagementApi(token);
  } else {
    console.log("SUPABASE_ACCESS_TOKEN not set — trying Supabase CLI…");
    await pushViaCli();
  }
} catch (err) {
  console.error("\n✗ Auth config push failed.");
  console.error(err instanceof Error ? err.message : err);
  console.error("\nFix: create a token at https://supabase.com/dashboard/account/tokens");
  console.error("Then: SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:config:push");
  process.exit(1);
}

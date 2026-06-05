/**
 * Push auth settings to phonara-gb via Supabase Management API.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:config:push
 *
 * Token: https://supabase.com/dashboard/account/tokens
 * Falls back to `supabase config push` when the CLI is logged in.
 */
const PROJECT_REF = "kanftnqenuzverroodev";

const AUTH_PATCH = {
  site_url: "http://localhost:8080",
  uri_allow_list:
    "http://localhost:8080/**,http://localhost:8080,http://127.0.0.1:8080/**,http://127.0.0.1:8080,http://localhost:5174/**,http://localhost:5174",
  passkey_enabled: true,
  webauthn_rp_display_name: "PHONARA",
  webauthn_rp_id: "localhost",
  webauthn_rp_origins: "http://localhost:8080,http://localhost:5174,http://127.0.0.1:8080",
  mailer_autoconfirm: true,
  external_email_enabled: true,
  disable_signup: false,
} as const;

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

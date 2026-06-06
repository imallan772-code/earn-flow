/**
 * Enable Google OAuth on phonara-gb (Management API).
 *
 * Prerequisites: Google Cloud OAuth Web client + redirect URI (see docs/GOOGLE_OAUTH_SETUP.md)
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx bun run supabase:auth:google
 *
 * (.env with SUPABASE_ACCESS_TOKEN + GOOGLE_* also works)
 */
import { googleOAuthPatchFromEnv, GOOGLE_OAUTH_REDIRECT_URI } from "./auth-config/google-oauth";

const PROJECT_REF = "kanftnqenuzverroodev";

async function pushAuthConfig(token: string, patch: Record<string, unknown>) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const google = googleOAuthPatchFromEnv();

if (!token) {
  console.error("✗ SUPABASE_ACCESS_TOKEN required (.env)");
  process.exit(1);
}

if (Object.keys(google).length === 0) {
  console.error("✗ Missing Google OAuth credentials in .env:");
  console.error("  GOOGLE_CLIENT_ID=...");
  console.error("  GOOGLE_CLIENT_SECRET=...");
  console.error("\nSetup guide: docs/GOOGLE_OAUTH_SETUP.md");
  console.error(`\nRedirect URI (Google Cloud Console):\n  ${GOOGLE_OAUTH_REDIRECT_URI}`);
  process.exit(1);
}

try {
  console.log(`→ Google OAuth → ${PROJECT_REF}`);
  const after = await pushAuthConfig(token, google);
  console.log("✓ Google provider enabled");
  console.log(`  client_id: ${String(after.external_google_client_id).slice(0, 12)}…`);
  console.log(`\nTest: http://localhost:8080/login → 구글 탭 → "구글 계정으로 계속"`);
} catch (err) {
  console.error("\n✗ Push failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}

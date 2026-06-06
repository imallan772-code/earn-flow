/**
 * Push Custom SMTP + PHONARA branded email templates (Free plan OK).
 *
 * Prerequisites (.env):
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_ADMIN_EMAIL
 *   SMTP_SENDER_NAME=PHONARA  (optional)
 *
 * Usage:
 *   bun run supabase:auth:smtp
 */
import { phonaraEmailBrandingPatch } from "./auth-config/phonara-email-branding";
import { smtpPatchFromEnv } from "./auth-config/part5-security";

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
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function requireSmtpEnv(): Record<string, string | number> {
  const patch = smtpPatchFromEnv();
  const required = ["smtp_host", "smtp_user", "smtp_pass", "smtp_admin_email"] as const;
  const missing = required.filter((k) => !(k in patch));
  if (missing.length > 0) {
    console.error("✗ Missing SMTP env:", missing.join(", "));
    console.error("  See docs/SMTP_PHONARA_SETUP.md");
    process.exit(1);
  }
  return patch;
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("✗ SUPABASE_ACCESS_TOKEN required in .env");
  process.exit(1);
}

const smtp = requireSmtpEnv();

try {
  console.log(`→ Custom SMTP + PHONARA templates → ${PROJECT_REF}`);

  // Step 1: SMTP credentials (must be live before template edit)
  await pushAuthConfig(token, { ...smtp, external_email_enabled: true });
  console.log(`✓ SMTP connected (${smtp.smtp_host})`);

  // Step 2: Subjects + HTML bodies
  const branding = phonaraEmailBrandingPatch();
  await pushAuthConfig(token, branding);
  console.log(`✓ PHONARA branding pushed (${Object.keys(branding).length} fields)`);

  const verify = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json() as Promise<Record<string, unknown>>);

  console.log("\n── Verification ──");
  console.log(`✓ smtp_host: ${String(verify.smtp_host)}`);
  console.log(`✓ subject: ${String(verify.mailer_subjects_confirmation)}`);
  console.log("\n  Dashboard → Authentication → Emails → preview templates");
  console.log("  Test: sign up or password reset to your inbox");
} catch (err) {
  console.error("\n✗ SMTP push failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}

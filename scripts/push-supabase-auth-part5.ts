/**
 * Push Part 5 Auth security to phonara-gb (Management API).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:auth:part5
 *
 * Free tier: notifications + reauth OK; HIBP requires Pro; subjects need SMTP.
 */
import {
  AUTH_PART5_HIBP,
  AUTH_PART5_SECURITY,
  smtpPatchFromEnv,
} from "./auth-config/part5-security";

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

async function fetchAuthConfig(token: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${res.status}: ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>>;
}

function printVerification(after: Record<string, unknown>) {
  const checks: [string, string][] = [
    ["password_hibp_enabled", "Leaked password (HIBP) — Pro plan"],
    ["mailer_notifications_password_changed_enabled", "Notify: password changed"],
    ["mailer_notifications_email_changed_enabled", "Notify: email changed"],
    ["mailer_notifications_identity_linked_enabled", "Notify: sign-in linked"],
    ["mailer_notifications_mfa_factor_enrolled_enabled", "Notify: MFA enrolled"],
    ["security_update_password_require_reauthentication", "Password change reauth"],
    ["mailer_secure_email_change_enabled", "Secure email change"],
  ];

  console.log("\n── Verification ──");
  for (const [key, label] of checks) {
    const val = after[key];
    const ok = val === true;
    console.log(`${ok ? "✓" : "○"} ${label} (${String(val)})`);
  }

  console.log(
    after.smtp_host
      ? `✓ Custom SMTP: ${String(after.smtp_host)}`
      : "○ Custom SMTP: not configured",
  );
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("✗ SUPABASE_ACCESS_TOKEN required (.env)");
  process.exit(1);
}

const smtpKeys = Object.keys(smtpPatchFromEnv());
const hasSmtp = smtpKeys.length > 0;

try {
  console.log(`→ Part 5 auth security → ${PROJECT_REF}`);

  // Core toggles (Free tier OK)
  const core = { ...AUTH_PART5_SECURITY };
  await pushAuthConfig(token, core);
  console.log("✓ Security toggles pushed");

  if (process.env.AUTH_SKIP_HIBP !== "1") {
    try {
      await pushAuthConfig(token, { ...AUTH_PART5_HIBP });
      console.log("✓ Leaked password protection (HIBP) enabled");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("402") || msg.includes("Pro Plan")) {
        console.log("○ HIBP skipped — requires Supabase Pro plan");
      } else {
        throw err;
      }
    }
  } else {
    console.log("○ AUTH_SKIP_HIBP=1 — skipping HIBP");
  }

  // SMTP + PHONARA subjects (optional)
  if (hasSmtp) {
    const smtp = smtpPatchFromEnv();
    await pushAuthConfig(token, { ...smtp, external_email_enabled: true });
    console.log(`✓ Custom SMTP connected (${smtp.smtp_host})`);
    const { phonaraEmailBrandingPatch } = await import("./auth-config/phonara-email-branding");
    await pushAuthConfig(token, phonaraEmailBrandingPatch());
    console.log("✓ PHONARA email subjects + HTML templates pushed");
  } else {
    console.log("○ No SMTP_* in .env — run: bun run supabase:auth:smtp (see docs/SMTP_PHONARA_SETUP.md)");
  }

  const after = await fetchAuthConfig(token);
  printVerification(after);
  console.log("\n✓ Part 5 complete. Refresh Dashboard → Authentication → Emails → Security");
} catch (err) {
  console.error("\n✗ Push failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}

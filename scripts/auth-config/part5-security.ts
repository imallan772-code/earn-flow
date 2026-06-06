/**
 * Part 5 — Auth security patch (Management API / config push SSOT).
 * phonara-gb only. No secrets in repo — SMTP from env at push time.
 */

/** Dev baseline — keep signup friction low locally. */
export const AUTH_DEV_BASE = {
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

/** Tier-1 security toggles — Free tier OK (excludes HIBP — Pro only). */
export const AUTH_PART5_SECURITY = {
  security_update_password_require_reauthentication: true,
  mailer_secure_email_change_enabled: true,
  mailer_notifications_password_changed_enabled: true,
  mailer_notifications_email_changed_enabled: true,
  mailer_notifications_phone_changed_enabled: true,
  mailer_notifications_identity_linked_enabled: true,
  mailer_notifications_identity_unlinked_enabled: true,
  mailer_notifications_mfa_factor_enrolled_enabled: true,
  mailer_notifications_mfa_factor_unenrolled_enabled: true,
} as const;

/** Pro plan only — pushed separately; 402 on Free. */
export const AUTH_PART5_HIBP = {
  password_hibp_enabled: true,
} as const;

/** Subjects/branding — only when Custom SMTP is configured (Free + default mailer rejects). */
export const AUTH_PART5_EMAIL_SUBJECTS = {
  mailer_subjects_password_changed_notification: "PHONARA · 비밀번호가 변경되었습니다",
  mailer_subjects_email_changed_notification: "PHONARA · 이메일 주소가 변경되었습니다",
  mailer_subjects_phone_changed_notification: "PHONARA · 전화번호가 변경되었습니다",
  mailer_subjects_identity_linked_notification: "PHONARA · 새 로그인 수단이 연결되었습니다",
  mailer_subjects_identity_unlinked_notification: "PHONARA · 로그인 수단 연결이 해제되었습니다",
  mailer_subjects_mfa_factor_enrolled_notification: "PHONARA · MFA가 추가되었습니다",
  mailer_subjects_mfa_factor_unenrolled_notification: "PHONARA · MFA가 제거되었습니다",
  mailer_subjects_confirmation: "PHONARA · 이메일을 확인해 주세요",
  mailer_subjects_recovery: "PHONARA · 비밀번호 재설정",
  mailer_subjects_magic_link: "PHONARA · 로그인 링크",
  mailer_subjects_reauthentication: "PHONARA · 본인 확인 코드",
  mailer_subjects_email_change: "PHONARA · 새 이메일 확인",
  mailer_subjects_invite: "PHONARA · 초대장",
} as const;

export type AuthConfigPatch = Record<string, string | number | boolean>;

/** Optional Custom SMTP — only included when env vars present. */
export function smtpPatchFromEnv(): AuthConfigPatch {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const adminEmail = process.env.SMTP_ADMIN_EMAIL?.trim();
  const senderName = process.env.SMTP_SENDER_NAME?.trim() ?? "PHONARA";

  if (!host || !user || !pass || !adminEmail) {
    return {};
  }

  const port = Number(process.env.SMTP_PORT ?? "587");

  return {
    smtp_admin_email: adminEmail,
    smtp_host: host,
    smtp_port: String(Number.isFinite(port) ? port : 587),
    smtp_user: user,
    smtp_pass: pass,
    smtp_sender_name: senderName,
  };
}

export function buildAuthPatch(options: {
  part5?: boolean;
  smtp?: boolean;
}): AuthConfigPatch {
  const patch: AuthConfigPatch = { ...AUTH_DEV_BASE };
  if (options.part5) {
    Object.assign(patch, AUTH_PART5_SECURITY);
    if (options.smtp) {
      Object.assign(patch, AUTH_PART5_EMAIL_SUBJECTS);
    }
  }
  if (options.smtp) {
    Object.assign(patch, smtpPatchFromEnv());
  }
  return patch;
}

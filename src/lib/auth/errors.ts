import { t } from "@/shared/i18n";

/** Map Supabase Auth API errors to user-facing copy (i18n where known). */
export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("different from the old password")) {
    return t("auth.passwordSameAsOld");
  }
  if (
    lower.includes("provider is not enabled") ||
    lower.includes("unsupported provider") ||
    lower.includes("validation failed")
  ) {
    return t("auth.googleNotConfigured");
  }
  if (lower.includes("bad_oauth_state") || lower.includes("oauth state")) {
    return t("auth.oauthStateExpired");
  }
  if (lower.includes("code verifier not found") || lower.includes("pkce")) {
    return t("auth.oauthPkceMissing");
  }
  return message;
}

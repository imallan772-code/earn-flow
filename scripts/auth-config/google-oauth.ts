import type { AuthConfigPatch } from "./part5-security";

/** Google OAuth — from env at push time (never commit secrets). */
export function googleOAuthPatchFromEnv(): AuthConfigPatch {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !secret) {
    return {};
  }

  return {
    external_google_enabled: true,
    external_google_client_id: clientId,
    external_google_secret: secret,
  };
}

export const GOOGLE_OAUTH_REDIRECT_URI =
  "https://kanftnqenuzverroodev.supabase.co/auth/v1/callback";

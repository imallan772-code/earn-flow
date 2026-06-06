import type { Json } from "@/integrations/supabase/types";
import { getServiceRoleClient } from "@/integrations/supabase/serviceRole.server";
import type { OAuthChannelId, OAuthTokenSlice } from "./types";

function utmKeys(channel: OAuthChannelId): {
  access: string;
  refresh: string;
  expires: string;
  extra?: string;
} {
  switch (channel) {
    case "x":
      return { access: "xAccessToken", refresh: "xRefreshToken", expires: "xTokenExpiresAt" };
    case "linkedin":
      return {
        access: "linkedinAccessToken",
        refresh: "linkedinRefreshToken",
        expires: "linkedinTokenExpiresAt",
        extra: "linkedinMemberUrn",
      };
    case "tiktok":
      return {
        access: "tiktokAccessToken",
        refresh: "tiktokRefreshToken",
        expires: "tiktokTokenExpiresAt",
        extra: "tiktokOpenId",
      };
  }
}

export async function persistOAuthTokens(
  channel: OAuthChannelId,
  tokens: OAuthTokenSlice,
): Promise<void> {
  const supabase = getServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

  const { data: row, error: readErr } = await supabase
    .from("promo_settings")
    .select("default_utm")
    .eq("id", "default")
    .maybeSingle();
  if (readErr) throw readErr;

  const utm = { ...((row?.default_utm ?? {}) as Record<string, string>) };
  const keys = utmKeys(channel);
  if (tokens.accessToken) utm[keys.access] = tokens.accessToken;
  if (tokens.refreshToken) utm[keys.refresh] = tokens.refreshToken;
  if (tokens.expiresAt) utm[keys.expires] = tokens.expiresAt;
  if (keys.extra === "linkedinMemberUrn" && tokens.linkedinMemberUrn) {
    utm.linkedinMemberUrn = tokens.linkedinMemberUrn;
  }
  if (keys.extra === "tiktokOpenId" && tokens.tiktokOpenId) {
    utm.tiktokOpenId = tokens.tiktokOpenId;
  }

  const { error: writeErr } = await supabase
    .from("promo_settings")
    .update({ default_utm: utm as Json, updated_at: new Date().toISOString() })
    .eq("id", "default");
  if (writeErr) throw writeErr;
}

export function oauthConnectedFromUtm(utm: Record<string, string | undefined>): Record<
  OAuthChannelId,
  boolean
> {
  return {
    x: Boolean(utm.xAccessToken),
    linkedin: Boolean(utm.linkedinAccessToken),
    tiktok: Boolean(utm.tiktokAccessToken),
  };
}

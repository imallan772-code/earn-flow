import type { OAuthAppConfig } from "./config.server";
import { promoOAuthRedirectUri } from "./config.server";
import type { OAuthChannelId, OAuthTokenSlice } from "./types";

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
}

export async function exchangeOAuthCode(
  channel: OAuthChannelId,
  app: OAuthAppConfig,
  code: string,
  codeVerifier: string,
): Promise<OAuthTokenSlice> {
  const redirectUri = promoOAuthRedirectUri(channel);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: app.clientId,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (app.tokenAuth === "basic") {
    headers.Authorization = `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_secret", app.clientSecret);
  }

  const res = await fetch(app.tokenUrl, { method: "POST", headers, body });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${channel} token exchange ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) throw new Error(`${channel} token missing access_token`);

  const slice: OAuthTokenSlice = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:
      typeof json.expires_in === "number"
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : undefined,
    tiktokOpenId: json.open_id,
  };

  if (channel === "linkedin") {
    slice.linkedinMemberUrn = await fetchLinkedInMemberUrn(json.access_token);
  }

  return slice;
}

async function fetchLinkedInMemberUrn(accessToken: string): Promise<string | undefined> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const json = (await res.json()) as { sub?: string };
  if (!json.sub) return undefined;
  return json.sub.startsWith("urn:") ? json.sub : `urn:li:person:${json.sub}`;
}

export function buildAuthorizeUrl(
  channel: OAuthChannelId,
  app: OAuthAppConfig,
  state: string,
  codeChallenge: string,
): string {
  const redirectUri = promoOAuthRedirectUri(channel);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: app.clientId,
    redirect_uri: redirectUri,
    state,
    scope: app.scopes.join(" "),
  });

  if (channel === "x") {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  if (channel === "tiktok") {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  return `${app.authorizeUrl}?${params.toString()}`;
}

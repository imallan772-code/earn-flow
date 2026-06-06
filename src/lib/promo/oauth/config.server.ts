import process from "node:process";
import type { OAuthChannelId } from "./types";

export interface OAuthAppConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** X requires Basic auth on token endpoint */
  tokenAuth?: "basic" | "body";
}

function siteUrl(): string {
  return (
    process.env.VITE_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

export function promoOAuthRedirectUri(channel: OAuthChannelId): string {
  return `${siteUrl()}/api/admin/promo/oauth/${channel}/callback`;
}

export function promoOAuthChannelsRedirect(): string {
  return `${siteUrl()}/admin/promo/channels`;
}

export function resolveOAuthApp(channel: OAuthChannelId): OAuthAppConfig | null {
  switch (channel) {
    case "x": {
      const clientId = process.env.X_CLIENT_ID;
      const clientSecret = process.env.X_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      return {
        clientId,
        clientSecret,
        authorizeUrl: "https://twitter.com/i/oauth2/authorize",
        tokenUrl: "https://api.twitter.com/2/oauth2/token",
        scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
        tokenAuth: "basic",
      };
    }
    case "linkedin": {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      return {
        clientId,
        clientSecret,
        authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
        tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
        scopes: ["openid", "profile", "w_member_social", "email"],
        tokenAuth: "body",
      };
    }
    case "tiktok": {
      const clientId = process.env.TIKTOK_CLIENT_KEY;
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      return {
        clientId,
        clientSecret,
        authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
        tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
        scopes: ["user.info.basic", "video.publish"],
        tokenAuth: "body",
      };
    }
  }
}

export function oauthStateSecret(): string | null {
  return process.env.PROMO_OAUTH_STATE_SECRET || process.env.PROMO_CRON_SECRET || null;
}

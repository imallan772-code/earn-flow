import { createHmac, timingSafeEqual } from "node:crypto";
import type { OAuthChannelId, OAuthStatePayload } from "./types";
import { oauthStateSecret } from "./config.server";

const COOKIE_PREFIX = "promo_oauth_";
const MAX_AGE_SEC = 600;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodePayload(p: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}

function decodePayload(raw: string): OAuthStatePayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const p = JSON.parse(json) as OAuthStatePayload;
    if (!p.channel || !p.state || !p.codeVerifier || !p.userId || !p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export function oauthCookieName(channel: OAuthChannelId): string {
  return `${COOKIE_PREFIX}${channel}`;
}

export function sealOAuthState(
  payload: OAuthStatePayload,
  secret: string,
): string {
  const body = encodePayload(payload);
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function openOAuthState(
  sealed: string,
  secret: string,
): OAuthStatePayload | null {
  const dot = sealed.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = sealed.slice(0, dot);
  const sig = sealed.slice(dot + 1);
  const expected = sign(body, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const p = decodePayload(body);
  if (!p || p.exp < Date.now()) return null;
  return p;
}

export function buildOAuthStateCookie(
  channel: OAuthChannelId,
  payload: OAuthStatePayload,
): { name: string; value: string; maxAge: number } | null {
  const secret = oauthStateSecret();
  if (!secret) return null;
  return {
    name: oauthCookieName(channel),
    value: sealOAuthState(payload, secret),
    maxAge: MAX_AGE_SEC,
  };
}

export function readOAuthStateCookie(
  channel: OAuthChannelId,
  cookieHeader: string | null,
): OAuthStatePayload | null {
  const secret = oauthStateSecret();
  if (!secret || !cookieHeader) return null;
  const name = oauthCookieName(channel);
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return null;
  return openOAuthState(decodeURIComponent(match[1]), secret);
}

export function clearOAuthStateCookieHeader(channel: OAuthChannelId): string {
  return `${oauthCookieName(channel)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

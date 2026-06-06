export type OAuthChannelId = "x" | "linkedin" | "tiktok";

export const OAUTH_CHANNELS: OAuthChannelId[] = ["x", "linkedin", "tiktok"];

export function isOAuthChannel(id: string): id is OAuthChannelId {
  return OAUTH_CHANNELS.includes(id as OAuthChannelId);
}

export interface OAuthTokenSlice {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  /** LinkedIn author URN (urn:li:person:…) */
  linkedinMemberUrn?: string;
  /** TikTok open_id */
  tiktokOpenId?: string;
}

export interface OAuthStatePayload {
  channel: OAuthChannelId;
  state: string;
  codeVerifier: string;
  userId: string;
  exp: number;
}

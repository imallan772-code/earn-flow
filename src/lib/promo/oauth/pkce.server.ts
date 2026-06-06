import { createHash, randomBytes } from "node:crypto";

export function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function newOAuthState(): { state: string; codeVerifier: string; codeChallenge: string } {
  const state = randomUrlSafe(16);
  const codeVerifier = randomUrlSafe(32);
  return { state, codeVerifier, codeChallenge: pkceChallenge(codeVerifier) };
}

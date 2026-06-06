import { describe, expect, it } from "vitest";
import { pkceChallenge, randomUrlSafe } from "@/lib/promo/oauth/pkce.server";
import {
  openOAuthState,
  sealOAuthState,
} from "@/lib/promo/oauth/stateCookie.server";
import type { OAuthStatePayload } from "@/lib/promo/oauth/types";

describe("oauth pkce", () => {
  it("pkceChallenge is deterministic base64url sha256", () => {
    const v = "test-verifier-12345678901234567890123456789012";
    expect(pkceChallenge(v)).toBe(pkceChallenge(v));
    expect(pkceChallenge(v).length).toBeGreaterThan(10);
  });

  it("randomUrlSafe produces unique strings", () => {
    expect(randomUrlSafe()).not.toBe(randomUrlSafe());
  });
});

describe("oauth state cookie", () => {
  const secret = "test-secret";
  const payload: OAuthStatePayload = {
    channel: "x",
    state: "st",
    codeVerifier: "ver",
    userId: "u1",
    exp: Date.now() + 60_000,
  };

  it("seal and open round-trip", () => {
    const sealed = sealOAuthState(payload, secret);
    expect(openOAuthState(sealed, secret)).toEqual(payload);
  });

  it("rejects tampered signature", () => {
    const sealed = sealOAuthState(payload, secret);
    expect(openOAuthState(`${sealed}x`, secret)).toBeNull();
  });

  it("rejects expired payload", () => {
    const sealed = sealOAuthState({ ...payload, exp: Date.now() - 1 }, secret);
    expect(openOAuthState(sealed, secret)).toBeNull();
  });
});

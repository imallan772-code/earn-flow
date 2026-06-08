import { describe, expect, it, vi } from "vitest";
import { ensureAnonymousSession } from "../ensureAnonymousSession";

describe("ensureAnonymousSession", () => {
  it("restores an existing session", async () => {
    const session = { access_token: "token" };
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { existing: null, session } }),
      },
    };

    await expect(ensureAnonymousSession(supabase as never)).resolves.toBe(session);
  });

  it("does not call anonymous sign-up when no session exists", async () => {
    const signInAnonymously = vi.fn();
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        signInAnonymously,
      },
    };

    await expect(ensureAnonymousSession(supabase as never)).resolves.toBeNull();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});

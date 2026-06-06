import { describe, expect, it } from "vitest";
import { commitServerSeed, verifyRevealedSeed } from "@/shared/games/engine/provablyFair";
import { buildVerifyShareUrl, verifyProvablyFair } from "../verifyPublic";

const BASE = {
  serverSeed: "server-seed-fixed-1234567890",
  clientSeed: "client-seed-fixed",
  nonce: 7,
};

describe("verifyPublic", () => {
  it("commit hash matches verifyRevealedSeed", async () => {
    const hash = await commitServerSeed(BASE.serverSeed);
    const out = await verifyProvablyFair({ game: "crash", ...BASE, serverSeedHash: hash });
    expect(out.commitValid).toBe(true);
    expect(out.commitHash).toBe(hash);
    expect(out.detail).toMatch(/×$/);
  });

  it("rejects wrong commit hash", async () => {
    const hash = await commitServerSeed(BASE.serverSeed);
    const out = await verifyProvablyFair({
      game: "dice",
      ...BASE,
      serverSeedHash: hash.slice(0, -1) + "0",
    });
    expect(out.commitValid).toBe(false);
  });

  it("crash and dice are deterministic for same seeds", async () => {
    const a = await verifyProvablyFair({ game: "crash", ...BASE });
    const b = await verifyProvablyFair({ game: "crash", ...BASE });
    expect(a.detail).toBe(b.detail);

    const d1 = await verifyProvablyFair({ game: "dice", ...BASE });
    const d2 = await verifyProvablyFair({ game: "dice", ...BASE });
    expect(d1.detail).toBe(d2.detail);
  });

  it("mines requires mineCount", async () => {
    await expect(verifyProvablyFair({ game: "mines", ...BASE })).rejects.toThrow(/mineCount/);
  });

  it("wheel requires risk and segments", async () => {
    await expect(verifyProvablyFair({ game: "wheel", ...BASE })).rejects.toThrow(/risk/);
  });

  it("buildVerifyShareUrl encodes query", () => {
    const url = buildVerifyShareUrl("https://phonara.app", {
      game: "crash",
      ...BASE,
      serverSeedHash: "abc123",
    });
    expect(url).toContain("/fair/verify?");
    expect(url).toContain("game=crash");
    expect(url).toContain("hash=abc123");
  });

  it("verifyRevealedSeed roundtrip", async () => {
    const hash = await commitServerSeed(BASE.serverSeed);
    expect(await verifyRevealedSeed(BASE.serverSeed, hash)).toBe(true);
  });
});

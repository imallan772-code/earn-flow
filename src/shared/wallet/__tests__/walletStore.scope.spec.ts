import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_DEMO_GRANT,
  setWalletScope,
  wallet,
  __resetWalletStoreForTests,
} from "../walletStore";

describe("walletStore scope", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
    });
    __resetWalletStoreForTests();
  });

  it("starts each user scope with INITIAL_DEMO_GRANT", () => {
    expect(wallet.getBalance("demo")).toBe(INITIAL_DEMO_GRANT);
    setWalletScope("user-a");
    expect(wallet.getBalance("demo")).toBe(INITIAL_DEMO_GRANT);
  });

  it("does not bleed demo balance between users", () => {
    setWalletScope("user-a");
    wallet.tryDebit("demo", 1_000);
    expect(wallet.getBalance("demo")).toBe(9_000);

    setWalletScope("user-b");
    expect(wallet.getBalance("demo")).toBe(INITIAL_DEMO_GRANT);

    setWalletScope("user-a");
    expect(wallet.getBalance("demo")).toBe(9_000);
  });

  it("persists scoped balances to vault v2", async () => {
    wallet.tryDebit("demo", 500);
    setWalletScope("user-x");
    await new Promise((r) => setTimeout(r, 120));

    const raw = window.localStorage.getItem("phonara.wallet.v2");
    expect(raw).toBeTruthy();
    const vault = JSON.parse(raw!) as { scopes: Record<string, { demoBalance: number }> };
    expect(vault.scopes.__guest__.demoBalance).toBe(INITIAL_DEMO_GRANT - 500);
    expect(vault.scopes["user-x"].demoBalance).toBe(INITIAL_DEMO_GRANT);
  });
});

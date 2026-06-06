import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MIN_DEMO_BET,
  canAffordBet,
  wallet,
  __resetWalletStoreForTests,
} from "../walletStore";

describe("walletStore demo debit guards", () => {
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
    __resetWalletStoreForTests("__guest__", {
      demoBalance: 0,
      demoGranted: true,
      realBalance: 0,
      totalBets: 0,
      totalWagered: 0,
      netResult: 0,
      maxMultiplier: 0,
    });
  });

  it("rejects bets when demo balance is zero", () => {
    expect(wallet.tryDebit("demo", 10)).toBe(false);
    expect(wallet.getBalance("demo")).toBe(0);
  });

  it("rejects dust bets below MIN_DEMO_BET", () => {
    __resetWalletStoreForTests("__guest__", {
      demoBalance: 0.004,
      demoGranted: true,
      realBalance: 0,
      totalBets: 0,
      totalWagered: 0,
      netResult: 0,
      maxMultiplier: 0,
    });

    expect(wallet.tryDebit("demo", 0.004)).toBe(false);
    expect(wallet.getBalance("demo")).toBe(0.004);
  });

  it("treats sub-minBet balance as depleted for valid stake attempts", () => {
    __resetWalletStoreForTests("__guest__", {
      demoBalance: 0.009,
      demoGranted: true,
      realBalance: 0,
      totalBets: 0,
      totalWagered: 0,
      netResult: 0,
      maxMultiplier: 0,
    });

    expect(canAffordBet("demo", 0.009, 0.01)).toBe(false);
    expect(wallet.tryDebit("demo", 0.01)).toBe(false);
    expect(wallet.getBalance("demo")).toBe(0.009);
  });

  it("rounds demo debits to two decimals", () => {
    __resetWalletStoreForTests("__guest__", {
      demoBalance: 1,
      demoGranted: true,
      realBalance: 0,
      totalBets: 0,
      totalWagered: 0,
      netResult: 0,
      maxMultiplier: 0,
    });

    expect(wallet.tryDebit("demo", 0.01)).toBe(true);
    expect(wallet.getBalance("demo")).toBe(0.99);
    expect(MIN_DEMO_BET).toBe(0.01);
  });
});

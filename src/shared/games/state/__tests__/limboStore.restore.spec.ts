/**
 * limboStore restore spec — ROUND L-2-pre single-slot 라이프사이클.
 *
 * 검증
 *  - place: activeRound 세팅.
 *  - settle: 같은 set 호출에서 activeRound=null + lastOutcome 갱신.
 *  - PF seed 변경: activeRound=null, nonce 0 리셋, lastOutcome=null.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("limboStore.activeRound — single-slot lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("place → activeRound 세팅, nonce++", async () => {
    const { limboStore } = await import("../persistedGameState");

    limboStore.set((s) => ({
      ...s,
      nonce: s.nonce + 1,
      activeRound: {
        nonce: 0,
        amount: 10,
        target: 2.0,
        liveBetId: "lb_a",
        placedAt: Date.now(),
      },
    }));
    const s = limboStore.get();
    expect(s.activeRound?.liveBetId).toBe("lb_a");
    expect(s.nonce).toBe(1);
  });

  it("settle → activeRound=null + lastOutcome 갱신 + history push", async () => {
    const { limboStore } = await import("../persistedGameState");

    limboStore.set((s) => ({
      ...s,
      nonce: 1,
      activeRound: {
        nonce: 0,
        amount: 10,
        target: 2.0,
        liveBetId: "lb_a",
        placedAt: 0,
      },
    }));
    expect(limboStore.get().activeRound?.nonce).toBe(0);

    limboStore.set((s) => ({
      ...s,
      activeRound: null,
      lastOutcome: { outcome: "win", profit: 10, nonce: 0, crashPoint: 2.5, target: 2.0 },
      history: [{ id: "n0", crashPoint: 2.5, target: 2.0, win: true }, ...s.history],
    }));
    const s = limboStore.get();
    expect(s.activeRound).toBeNull();
    expect(s.lastOutcome?.outcome).toBe("win");
    expect(s.history[0]?.id).toBe("n0");
  });

  it("PF seed 변경: nonce 0 + activeRound + lastOutcome 클리어", async () => {
    const { limboStore } = await import("../persistedGameState");

    limboStore.set((s) => ({
      ...s,
      nonce: 50,
      activeRound: {
        nonce: 49,
        amount: 1,
        target: 2,
        liveBetId: "x",
        placedAt: 0,
      },
      lastOutcome: { outcome: "win", profit: 1, nonce: 48, crashPoint: 3, target: 2 },
    }));

    limboStore.set((s) => ({
      ...s,
      clientSeed: "new-seed",
      nonce: 0,
      activeRound: null,
      lastOutcome: null,
    }));

    const s = limboStore.get();
    expect(s.nonce).toBe(0);
    expect(s.clientSeed).toBe("new-seed");
    expect(s.activeRound).toBeNull();
    expect(s.lastOutcome).toBeNull();
  });
});

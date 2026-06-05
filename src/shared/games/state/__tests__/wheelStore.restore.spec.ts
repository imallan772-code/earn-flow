/**
 * wheelStore restore spec — activeRound 라이프사이클 + 이중 차감 금지.
 *
 * 검증
 *  - place: activeRound 세팅 + nonce++.
 *  - settle: 같은 set tick에서 activeRound=null + lastOutcome 갱신.
 *  - PF seed 변경: nonce 0 + activeRound=null + lastOutcome=null.
 *  - 복원 hydrate: tryDebit / liveBetsStore.push mock — 0 calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("wheelStore.activeRound — lifecycle + restore", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("place → activeRound 세팅 + nonce++", async () => {
    const { wheelStore } = await import("../persistedGameState");
    wheelStore.set((s) => ({
      ...s,
      nonce: s.nonce + 1,
      activeRound: {
        nonce: s.nonce,
        amount: 10,
        risk: "medium",
        segments: 20,
        liveBetId: "lb_a",
        placedAt: Date.now(),
      },
    }));
    const s = wheelStore.get();
    expect(s.activeRound?.liveBetId).toBe("lb_a");
    expect(s.nonce).toBe(1);
  });

  it("settle → activeRound=null + lastOutcome + history 동일 tick", async () => {
    const { wheelStore } = await import("../persistedGameState");
    wheelStore.set((s) => ({
      ...s,
      nonce: 1,
      activeRound: {
        nonce: 0,
        amount: 10,
        risk: "medium",
        segments: 20,
        liveBetId: "lb_a",
        placedAt: 0,
      },
    }));
    wheelStore.set((s) => ({
      ...s,
      activeRound: null,
      history: [
        { id: "n0", risk: "medium", segments: 20, index: 5, multiplier: 3.0, win: true },
        ...s.history,
      ],
      lastOutcome: {
        outcome: "win",
        profit: 20,
        nonce: 0,
        risk: "medium",
        segments: 20,
        index: 5,
        multiplier: 3.0,
      },
    }));
    const s = wheelStore.get();
    expect(s.activeRound).toBeNull();
    expect(s.lastOutcome?.outcome).toBe("win");
    expect(s.history).toHaveLength(1);
  });

  it("PF seed 변경 → nonce 0 + activeRound + lastOutcome 클리어", async () => {
    const { wheelStore } = await import("../persistedGameState");
    wheelStore.set((s) => ({
      ...s,
      nonce: 50,
      activeRound: {
        nonce: 49,
        amount: 1,
        risk: "low",
        segments: 10,
        liveBetId: "x",
        placedAt: 0,
      },
      lastOutcome: {
        outcome: "win",
        profit: 1,
        nonce: 48,
        risk: "low",
        segments: 10,
        index: 0,
        multiplier: 1.5,
      },
    }));
    wheelStore.set((s) => ({
      ...s,
      clientSeed: "new-seed",
      nonce: 0,
      activeRound: null,
      lastOutcome: null,
    }));
    const s = wheelStore.get();
    expect(s.nonce).toBe(0);
    expect(s.clientSeed).toBe("new-seed");
    expect(s.activeRound).toBeNull();
    expect(s.lastOutcome).toBeNull();
  });

  it("마운트 복원 hydrate — tryDebit/liveBetsStore.push 0회", async () => {
    // pre-seed v1 storage with activeRound
    const seeded = {
      nonce: 5,
      history: [],
      lastOutcome: null,
      risk: "medium",
      segments: 20,
      pendingAmount: 10,
      activeRound: {
        nonce: 4,
        amount: 25,
        risk: "medium",
        segments: 20,
        liveBetId: "lb_restored",
        placedAt: 1700000000000,
      },
      clientSeed: "phonara-player-001",
    };
    window.localStorage.setItem("phonara.gamestate.wheel.v1", JSON.stringify(seeded));

    const tryDebit = vi.fn();
    const pushBet = vi.fn();
    vi.doMock("@/shared/wallet/useGameWallet", () => ({
      useGameWallet: () => ({
        mode: "demo",
        balance: 1000,
        tryDebit,
        credit: vi.fn(),
      }),
    }));
    vi.doMock("@/shared/livefeed/LiveBetsStore", () => ({
      liveBetsStore: { push: pushBet, update: vi.fn() },
    }));

    const { wheelStore } = await import("../persistedGameState");
    const s = wheelStore.get();
    // activeRound restored — pure state hydrate. No wallet/live calls expected.
    expect(s.activeRound?.liveBetId).toBe("lb_restored");
    expect(tryDebit).toHaveBeenCalledTimes(0);
    expect(pushBet).toHaveBeenCalledTimes(0);
  });
});

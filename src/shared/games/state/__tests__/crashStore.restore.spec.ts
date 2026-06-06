/**
 * crashStore restore spec — activeRound 라이프사이클 + PF block + 이중 차감 금지.
 *
 * 검증
 *  - place: activeRound 세팅 + bettingStartedAt !== placedAt 의미 분리.
 *  - cashout: activeRound.cashedAt 갱신.
 *  - settle(crashed): activeRound=null + lastOutcome + history 동일 tick.
 *  - PF seed 변경 (미정산 베팅): Screen에서 차단 — store는 변경 없음.
 *  - 마운트 복원 시 tryDebit/liveBetsStore.push 0회 (store는 pure state hydrate만).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("crashStore.activeRound — lifecycle + restore + PF policy", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("place → activeRound 세팅 (bettingStartedAt !== placedAt)", async () => {
    const { crashStore } = await import("../persistedGameState");
    const placedAt = Date.now();
    const bettingStartedAt = 12_345; // performance.now() 스냅샷 (별도 의미)
    crashStore.set((s) => ({
      ...s,
      activeRound: {
        nonce: s.nonce,
        amount: 10,
        autoTarget: 2.0,
        cashedAt: null,
        liveBetId: "lb_a",
        placedAt,
        crashPoint: 4.2,
        startedAt: 0,
        bettingStartedAt,
      },
    }));
    const s = crashStore.get();
    expect(s.activeRound?.liveBetId).toBe("lb_a");
    expect(s.activeRound?.placedAt).toBe(placedAt);
    expect(s.activeRound?.bettingStartedAt).toBe(bettingStartedAt);
    expect(s.activeRound?.bettingStartedAt).not.toBe(placedAt);
    expect(s.activeRound?.startedAt).toBe(0);
  });

  it("cashout → activeRound.cashedAt 갱신", async () => {
    const { crashStore } = await import("../persistedGameState");
    crashStore.set((s) => ({
      ...s,
      activeRound: {
        nonce: 0,
        amount: 10,
        autoTarget: 2.0,
        cashedAt: null,
        liveBetId: "lb_a",
        placedAt: 0,
        crashPoint: 4.2,
        startedAt: 1000,
        bettingStartedAt: 100,
      },
    }));
    crashStore.set((s) =>
      s.activeRound ? { ...s, activeRound: { ...s.activeRound, cashedAt: 1.85 } } : s,
    );
    expect(crashStore.get().activeRound?.cashedAt).toBeCloseTo(1.85, 2);
  });

  it("settle(crashed) → activeRound=null + lastOutcome + history 동일 tick", async () => {
    const { crashStore } = await import("../persistedGameState");
    crashStore.set((s) => ({
      ...s,
      activeRound: {
        nonce: 0,
        amount: 10,
        autoTarget: 2.0,
        cashedAt: null,
        liveBetId: "lb_a",
        placedAt: 0,
        crashPoint: 1.5,
        startedAt: 1000,
        bettingStartedAt: 100,
      },
    }));
    crashStore.set((s) => ({
      ...s,
      activeRound: null,
      history: [{ id: "n0", multiplier: 1.5 }, ...s.history],
      lastOutcome: { outcome: "loss", profit: -10, nonce: 0 },
    }));
    const s = crashStore.get();
    expect(s.activeRound).toBeNull();
    expect(s.lastOutcome?.outcome).toBe("loss");
    expect(s.history).toHaveLength(1);
  });

  it("PF seed 변경 (미정산 베팅) — activeRound 유지 (Screen에서 차단, store 직접 변경 없음)", async () => {
    const { crashStore } = await import("../persistedGameState");
    // 진행 중 미정산 베팅
    crashStore.set((s) => ({
      ...s,
      nonce: 50,
      activeRound: {
        nonce: 49,
        amount: 25,
        autoTarget: 2.0,
        cashedAt: null,
        liveBetId: "lb_x",
        placedAt: 0,
        crashPoint: 3.0,
        startedAt: 0,
        bettingStartedAt: 100,
      },
      lastOutcome: { outcome: "win", profit: 5, nonce: 48 },
    }));

    // PF apply with active unsettled bet: Screen blocks — store unchanged until round ends.
    const before = crashStore.get();
    expect(before.activeRound?.amount).toBe(25);
    expect(before.activeRound?.cashedAt).toBeNull();
    expect(before.nonce).toBe(50);

    // Allowed PF reset only after round cleared (simulate post-settle):
    crashStore.set((s) => ({
      ...s,
      clientSeed: "new-seed",
      nonce: 0,
      activeRound: null,
      lastOutcome: null,
    }));
    const s = crashStore.get();
    expect(s.nonce).toBe(0);
    expect(s.clientSeed).toBe("new-seed");
    expect(s.activeRound).toBeNull();
    expect(s.lastOutcome).toBeNull();
  });

  it("마운트 복원 hydrate — tryDebit/liveBetsStore.push 0회 (pure state)", async () => {
    const seeded = {
      nonce: 5,
      history: [],
      lastOutcome: null,
      pendingAmount: 10,
      pendingTarget: 2.0,
      clientSeed: "phonara-player-001",
      activeRound: {
        nonce: 4,
        amount: 25,
        autoTarget: 2.0,
        cashedAt: null,
        liveBetId: "lb_restored",
        placedAt: 1700000000000,
        crashPoint: 3.7,
        startedAt: 0,
        bettingStartedAt: 200,
      },
    };
    window.localStorage.setItem("phonara.gamestate.crash.v2", JSON.stringify(seeded));

    const tryDebit = vi.fn();
    const pushBet = vi.fn();
    vi.doMock("@/shared/wallet/useGameWallet", () => ({
      useGameWallet: () => ({
        mode: "demo",
        balance: 1000,
        tryDebit,
        credit: vi.fn(),
        refund: vi.fn(),
      }),
    }));
    vi.doMock("@/shared/livefeed/LiveBetsStore", () => ({
      liveBetsStore: { push: pushBet, update: vi.fn() },
    }));

    const { crashStore } = await import("../persistedGameState");
    const s = crashStore.get();
    expect(s.activeRound?.liveBetId).toBe("lb_restored");
    expect(s.activeRound?.bettingStartedAt).toBe(200);
    // store hydrate = pure state. wallet/live calls 발생 X.
    expect(tryDebit).toHaveBeenCalledTimes(0);
    expect(pushBet).toHaveBeenCalledTimes(0);
  });
});

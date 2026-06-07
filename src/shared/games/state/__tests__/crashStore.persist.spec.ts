/**
 * crashStore persist spec — ROUND L-1 신규 필드(clientSeed + activeRound) 호환성.
 *
 * 시나리오
 *  - 기존 v2 저장본(신규 필드 없음)이 새 코드와 만나도
 *    `createGameStore`의 `{ ...initial, ...parsed }` 머지로 기본값 주입.
 *  - localStorage key는 `phonara.gamestate.crash.v2` 그대로 (version=2 유지, v3 없음).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "phonara.gamestate.crash.v2";

describe("crashStore — v2 hydrate merges ROUND L-1 fields", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("localStorage key는 .v2 그대로 (version 변경 없음)", async () => {
    const { crashStore } = await import("../persistedGameState");
    crashStore.set((s) => ({ ...s, pendingAmount: 42 }));
    await new Promise((r) => setTimeout(r, 120));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem("phonara.gamestate.crash.v3")).toBeNull();
  });

  it("기존 v2 저장본에 신규 필드 없으면 기본값으로 채워서 로드", async () => {
    const legacy = {
      nonce: 9,
      history: [{ id: "n0", multiplier: 2.45 }],
      lastOutcome: null,
      pendingAmount: 25,
      pendingTarget: 1.8,
    };
    window.localStorage.setItem(KEY, JSON.stringify(legacy));

    const { crashStore } = await import("../persistedGameState");
    const s = crashStore.get();

    // 기존 필드 보존
    expect(s.nonce).toBe(9);
    expect(s.pendingAmount).toBe(25);
    expect(s.pendingTarget).toBe(1.8);
    expect(s.history).toHaveLength(1);
    // 신규 필드 기본값 주입
    expect(s.activeRound).toBeNull();
    expect(s.clientSeed).toBe("phonara-player-001");
  });

  it("이미 신규 필드를 가진 저장본은 그대로 로드", async () => {
    const stored = {
      nonce: 3,
      history: [],
      lastOutcome: null,
      pendingAmount: 10,
      pendingTarget: 2.0,
      clientSeed: "custom-seed",
      activeRound: {
        nonce: 2,
        amount: 50,
        autoTarget: 2.0,
        cashedAt: null,
        liveBetId: "lb_test",
        placedAt: 1700000000000,
        crashPoint: 3.14,
        startedAt: 0,
        bettingStartedAt: 12345,
      },
    };
    window.localStorage.setItem(KEY, JSON.stringify(stored));

    const { crashStore } = await import("../persistedGameState");
    const s = crashStore.get();

    expect(s.clientSeed).toBe("custom-seed");
    expect(s.activeRound?.liveBetId).toBe("lb_test");
    expect(s.activeRound?.crashPoint).toBeCloseTo(3.14, 2);
    expect(s.activeRound?.bettingStartedAt).toBe(12345);
  });

  it("JSON null crashPoint from Infinity round-trip restores server unknown sentinel", async () => {
    const stored = {
      nonce: 5,
      history: [],
      lastOutcome: null,
      pendingAmount: 10,
      pendingTarget: 2.0,
      clientSeed: "phonara-player-001",
      activeRound: {
        nonce: 5,
        amount: 10,
        autoTarget: 2.0,
        cashedAt: null,
        liveBetId: "lb_test",
        placedAt: 1700000000000,
        crashPoint: null,
        startedAt: 0,
        bettingStartedAt: 12345,
        serverSide: true,
      },
    };
    window.localStorage.setItem(KEY, JSON.stringify(stored));

    const { crashStore } = await import("../persistedGameState");
    expect(crashStore.get().activeRound?.crashPoint).toBe(Number.POSITIVE_INFINITY);
  });
});

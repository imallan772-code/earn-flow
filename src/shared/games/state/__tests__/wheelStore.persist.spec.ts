/**
 * wheelStore persist spec — ROUND J 신규 필드 호환성.
 *
 * 시나리오
 *  - 기존 v1 저장본(activeRound / clientSeed 없음)이 새 코드와 만나도
 *    `createGameStore`의 `{ ...initial, ...parsed }` 머지로 신규 필드가 기본값으로 주입.
 *  - localStorage key는 `phonara.gamestate.wheel.v1` 그대로 (version=1 유지).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "phonara.gamestate.wheel.v1";

describe("wheelStore — v1 hydrate merges new ROUND J fields", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("localStorage key는 .v1 그대로 (version 변경 없음)", async () => {
    const { wheelStore } = await import("../persistedGameState");
    wheelStore.set((s) => ({ ...s, pendingAmount: 42 }));
    await new Promise((r) => setTimeout(r, 120));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem("phonara.gamestate.wheel.v2")).toBeNull();
  });

  it("기존 v1 저장본에 신규 필드 없으면 기본값으로 채워서 로드", async () => {
    const legacy = {
      nonce: 7,
      history: [
        { id: "n0", risk: "medium", segments: 20, index: 3, multiplier: 1.8, win: true },
      ],
      lastOutcome: null,
      risk: "high",
      segments: 30,
      pendingAmount: 25,
    };
    window.localStorage.setItem(KEY, JSON.stringify(legacy));

    const { wheelStore } = await import("../persistedGameState");
    const s = wheelStore.get();

    // 기존 필드 보존
    expect(s.nonce).toBe(7);
    expect(s.risk).toBe("high");
    expect(s.segments).toBe(30);
    expect(s.pendingAmount).toBe(25);
    expect(s.history).toHaveLength(1);
    // 신규 필드 기본값 주입
    expect(s.activeRound).toBeNull();
    expect(s.clientSeed).toBe("phonara-player-001");
  });

  it("이미 신규 필드를 가진 저장본은 그대로 로드", async () => {
    const stored = {
      nonce: 12,
      history: [],
      lastOutcome: null,
      risk: "low",
      segments: 10,
      pendingAmount: 10,
      activeRound: {
        nonce: 10,
        amount: 50,
        risk: "low",
        segments: 10,
        liveBetId: "lb_test",
        placedAt: 1700000000000,
      },
      clientSeed: "custom-seed",
    };
    window.localStorage.setItem(KEY, JSON.stringify(stored));

    const { wheelStore } = await import("../persistedGameState");
    const s = wheelStore.get();

    expect(s.activeRound?.liveBetId).toBe("lb_test");
    expect(s.activeRound?.amount).toBe(50);
    expect(s.clientSeed).toBe("custom-seed");
  });
});

/**
 * limboStore persist spec — ROUND I 신규 필드 호환성.
 *
 * 시나리오
 *  - 기존 v1 저장본(activeRounds / clientSeed / activeSlot / lastOutcomeBySlot 없음)이
 *    새 코드와 만나도 `createGameStore`의 `{ ...initial, ...parsed }` 머지로 신규 필드가
 *    기본값으로 주입.
 *  - localStorage key는 `phonara.gamestate.limbo.v1` 그대로 (version=1 유지).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "phonara.gamestate.limbo.v1";

describe("limboStore — v1 hydrate merges new ROUND I fields", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("localStorage key는 .v1 그대로 (version 변경 없음)", async () => {
    const { limboStore } = await import("../persistedGameState");
    limboStore.set((s) => ({ ...s, pendingAmount: 42 }));
    await new Promise((r) => setTimeout(r, 120));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem("phonara.gamestate.limbo.v2")).toBeNull();
  });

  it("기존 v1 저장본에 신규 필드 없으면 기본값으로 채워서 로드", async () => {
    const legacy = {
      nonce: 5,
      history: [{ id: "n0", crashPoint: 2.34, target: 2.0, win: true }],
      lastOutcome: null,
      target: 3.5,
      pendingAmount: 25,
    };
    window.localStorage.setItem(KEY, JSON.stringify(legacy));

    const { limboStore } = await import("../persistedGameState");
    const s = limboStore.get();

    // 기존 필드 보존
    expect(s.nonce).toBe(5);
    expect(s.target).toBe(3.5);
    expect(s.pendingAmount).toBe(25);
    expect(s.history).toHaveLength(1);
    // 신규 필드 기본값 주입
    expect(s.activeRounds).toEqual([null, null]);
    expect(s.lastOutcomeBySlot).toEqual([null, null]);
    expect(s.clientSeed).toBe("phonara-player-001");
    expect(s.activeSlot).toBe(0);
  });

  it("이미 신규 필드를 가진 저장본은 그대로 로드", async () => {
    const stored = {
      nonce: 12,
      history: [],
      lastOutcome: null,
      lastOutcomeBySlot: [null, null],
      target: 2.0,
      pendingAmount: 10,
      activeRounds: [
        {
          nonce: 10,
          amount: 50,
          target: 2.5,
          liveBetId: "lb_test",
          placedAt: 1700000000000,
          slot: 0,
        },
        null,
      ],
      clientSeed: "custom-seed",
      activeSlot: 1,
    };
    window.localStorage.setItem(KEY, JSON.stringify(stored));

    const { limboStore } = await import("../persistedGameState");
    const s = limboStore.get();

    expect(s.activeRounds[0]?.liveBetId).toBe("lb_test");
    expect(s.activeRounds[0]?.target).toBe(2.5);
    expect(s.activeRounds[1]).toBeNull();
    expect(s.clientSeed).toBe("custom-seed");
    expect(s.activeSlot).toBe(1);
  });
});

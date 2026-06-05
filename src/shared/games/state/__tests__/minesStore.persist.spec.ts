/**
 * minesStore persist spec — 기존 v1 JSON 호환성 검증.
 *
 * 시나리오
 *  - ROUND H 이전 저장본(activeRound·clientSeed 필드 없음)이 새 코드와 만나도
 *    `createGameStore`의 `{ ...initial, ...parsed }` 머지로 신규 필드가 기본값으로 주입.
 *  - localStorage key는 `phonara.gamestate.mines.v1` 그대로 (version=1 유지).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "phonara.gamestate.mines.v1";

describe("minesStore — v1 hydrate merges new ROUND H fields", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("localStorage key는 .v1 그대로 (version 변경 없음)", async () => {
    const { minesStore } = await import("../persistedGameState");
    minesStore.set((s) => ({ ...s, pendingAmount: 42 }));
    // debounce(80ms) flush 대기
    await new Promise((r) => setTimeout(r, 120));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem("phonara.gamestate.mines.v2")).toBeNull();
  });

  it("v1 저장본에 activeRound/clientSeed 없으면 기본값으로 채워서 로드", async () => {
    const legacy = {
      nonce: 7,
      history: [{ id: "n0", mineCount: 3, revealed: 1, multiplier: 1.23, win: false }],
      lastOutcome: null,
      mineCount: 5,
      pendingAmount: 25,
    };
    window.localStorage.setItem(KEY, JSON.stringify(legacy));

    const { minesStore } = await import("../persistedGameState");
    const s = minesStore.get();

    // 기존 필드는 보존
    expect(s.nonce).toBe(7);
    expect(s.mineCount).toBe(5);
    expect(s.pendingAmount).toBe(25);
    expect(s.history).toHaveLength(1);
    // 신규 필드는 기본값 주입
    expect(s.activeRound).toBeNull();
    expect(s.clientSeed).toBe("phonara-player-001");
  });

  it("이미 신규 필드를 가진 저장본은 그대로 로드", async () => {
    const stored = {
      nonce: 2,
      history: [],
      lastOutcome: null,
      mineCount: 3,
      pendingAmount: 10,
      activeRound: {
        nonce: 2,
        amount: 50,
        mineCount: 3,
        mines: [1, 5, 17],
        revealed: [0, 2],
        liveBetId: "lb_test",
        placedAt: 1700000000000,
      },
      clientSeed: "custom-seed",
    };
    window.localStorage.setItem(KEY, JSON.stringify(stored));

    const { minesStore } = await import("../persistedGameState");
    const s = minesStore.get();

    expect(s.activeRound?.liveBetId).toBe("lb_test");
    expect(s.activeRound?.revealed).toEqual([0, 2]);
    expect(s.clientSeed).toBe("custom-seed");
  });
});

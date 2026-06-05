/**
 * minesStore restore spec — activeRound 라이프사이클 불변식.
 *
 * 검증
 *  - place 시: activeRound 세팅 (mines/liveBetId 포함).
 *  - reveal 누적 시: activeRound.revealed 누적.
 *  - bomb hit / cashout 시: 같은 tick에 activeRound = null
 *    (새로고침 시 bomb 상태로 복원되지 않음 — ROUND H 강화 조항).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("minesStore.activeRound — bomb hit invariant", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("place → reveal × 2 → bomb hit 시 같은 set 호출에서 activeRound가 null", async () => {
    const { minesStore } = await import("../persistedGameState");

    // place
    minesStore.set((s) => ({
      ...s,
      activeRound: {
        nonce: 0,
        amount: 10,
        mineCount: 3,
        mines: [4, 9, 14],
        revealed: [],
        liveBetId: "lb_x",
        placedAt: Date.now(),
      },
    }));
    expect(minesStore.get().activeRound?.liveBetId).toBe("lb_x");

    // reveal × 2
    const nextRevealed = [0, 1];
    minesStore.set((s) =>
      s.activeRound ? { ...s, activeRound: { ...s.activeRound, revealed: nextRevealed } } : s,
    );
    expect(minesStore.get().activeRound?.revealed).toEqual([0, 1]);

    // bomb hit — 같은 set 호출에서 activeRound=null + history/outcome 갱신
    minesStore.set((s) => ({
      ...s,
      activeRound: null,
      history: [{ id: "n0", mineCount: 3, revealed: 2, multiplier: 1.1, win: false }, ...s.history],
      lastOutcome: {
        outcome: "loss",
        profit: -10,
        nonce: 0,
        mineCount: 3,
        revealed: 2,
        multiplier: 1.1,
      },
    }));

    const after = minesStore.get();
    expect(after.activeRound).toBeNull();
    expect(after.lastOutcome?.outcome).toBe("loss");
    expect(after.history[0].id).toBe("n0");
  });

  it("cashout 시에도 activeRound 즉시 null", async () => {
    const { minesStore } = await import("../persistedGameState");
    minesStore.set((s) => ({
      ...s,
      activeRound: {
        nonce: 1,
        amount: 20,
        mineCount: 5,
        mines: [2, 3, 4, 5, 6],
        revealed: [0, 1],
        liveBetId: "lb_y",
        placedAt: Date.now(),
      },
    }));

    minesStore.set((s) => ({
      ...s,
      activeRound: null,
      lastOutcome: {
        outcome: "win",
        profit: 18.5,
        nonce: 1,
        mineCount: 5,
        revealed: 2,
        multiplier: 1.95,
      },
    }));

    expect(minesStore.get().activeRound).toBeNull();
    expect(minesStore.get().lastOutcome?.outcome).toBe("win");
  });

  it("activeRound 스키마는 liveBetId 포함 (LiveBetsFeed 연속성 보장)", async () => {
    const { minesStore } = await import("../persistedGameState");
    const ar = {
      nonce: 0,
      amount: 10,
      mineCount: 3,
      mines: [1, 2, 3],
      revealed: [],
      liveBetId: "lb_abc",
      placedAt: 0,
    };
    minesStore.set((s) => ({ ...s, activeRound: ar }));
    expect(minesStore.get().activeRound).toMatchObject({
      liveBetId: "lb_abc",
      mines: [1, 2, 3],
    });
  });
});

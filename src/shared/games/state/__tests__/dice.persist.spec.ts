/**
 * diceStore persist spec — ROUND K 신규 필드(clientSeed) 호환성.
 *
 * 시나리오
 *  - 기존 v2 저장본(clientSeed 없음)이 새 코드와 만나도
 *    `createGameStore`의 `{ ...initial, ...parsed }` 머지로 신규 필드가 기본값으로 주입.
 *  - localStorage key는 `phonara.gamestate.dice.v2` 그대로 (version=2 유지).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "phonara.gamestate.dice.v2";

describe("diceStore — v2 hydrate merges ROUND K clientSeed", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("localStorage key는 .v2 그대로 (version 변경 없음)", async () => {
    const { diceStore } = await import("../persistedGameState");
    diceStore.set((s) => ({ ...s, pendingAmount: 42 }));
    await new Promise((r) => setTimeout(r, 120));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem("phonara.gamestate.dice.v3")).toBeNull();
  });

  it("기존 v2 저장본에 clientSeed 없으면 기본값으로 채워서 로드", async () => {
    const legacy = {
      nonce: 9,
      history: [{ id: "n0", roll: 42.5, win: false }],
      lastRoll: 42.5,
      lastOutcome: null,
      target: 75,
      diceMode: "under",
      pendingAmount: 25,
    };
    window.localStorage.setItem(KEY, JSON.stringify(legacy));

    const { diceStore } = await import("../persistedGameState");
    const s = diceStore.get();

    // 기존 필드 보존
    expect(s.nonce).toBe(9);
    expect(s.target).toBe(75);
    expect(s.diceMode).toBe("under");
    expect(s.pendingAmount).toBe(25);
    expect(s.lastRoll).toBe(42.5);
    expect(s.history).toHaveLength(1);
    // 신규 필드 기본값 주입
    expect(s.clientSeed).toBe("phonara-player-001");
  });

  it("이미 clientSeed를 가진 저장본은 그대로 로드", async () => {
    const stored = {
      nonce: 3,
      history: [],
      lastRoll: null,
      lastOutcome: null,
      target: 50,
      diceMode: "over",
      pendingAmount: 10,
      clientSeed: "custom-seed",
    };
    window.localStorage.setItem(KEY, JSON.stringify(stored));

    const { diceStore } = await import("../persistedGameState");
    const s = diceStore.get();

    expect(s.clientSeed).toBe("custom-seed");
    expect(s.nonce).toBe(3);
  });
});

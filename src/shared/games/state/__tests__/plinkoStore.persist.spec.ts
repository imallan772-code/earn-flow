/**
 * plinkoStore persist spec — ROUND M (AC-M-5).
 *
 * 시나리오
 *  - localStorage key는 `phonara.gamestate.plinko.v1` 그대로 (version 변경 없음).
 *  - 부분 v1 저장본을 만나도 `createGameStore`의 `{ ...initial, ...parsed }` 머지로
 *    누락 필드는 기본값으로 안전 복원 (신규 필드 추가에도 호환).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "phonara.gamestate.plinko.v1";

describe("plinkoStore — v1 hydrate merges defaults (ROUND M)", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("localStorage key는 .v1 그대로 (version 변경 없음)", async () => {
    const { plinkoStore } = await import("../persistedGameState");
    plinkoStore.set((s) => ({ ...s, pendingAmount: 42 }));
    await new Promise((r) => setTimeout(r, 120));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem("phonara.gamestate.plinko.v2")).toBeNull();
  });

  it("부분 v1 저장본 → 누락 필드는 기본값으로 채워서 로드", async () => {
    const legacy = {
      nonce: 12,
      history: [{ id: "n1", multiplier: 5, slot: 7 }],
      rows: 12,
    };
    window.localStorage.setItem(KEY, JSON.stringify(legacy));

    const { plinkoStore } = await import("../persistedGameState");
    const s = plinkoStore.get();

    // 기존 필드 보존
    expect(s.nonce).toBe(12);
    expect(s.rows).toBe(12);
    expect(s.history).toHaveLength(1);
    expect(s.history[0]?.multiplier).toBe(5);
    // 기본값 주입
    expect(s.risk).toBe("medium");
    expect(s.pendingAmount).toBe(10);
    expect(s.lastOutcome).toBeNull();
  });

  it("완전 저장본은 그대로 로드", async () => {
    const stored = {
      nonce: 5,
      history: [],
      lastOutcome: null,
      rows: 16,
      risk: "high",
      pendingAmount: 25,
    };
    window.localStorage.setItem(KEY, JSON.stringify(stored));

    const { plinkoStore } = await import("../persistedGameState");
    const s = plinkoStore.get();

    expect(s.risk).toBe("high");
    expect(s.pendingAmount).toBe(25);
    expect(s.rows).toBe(16);
    expect(s.nonce).toBe(5);
  });

  it("빈 localStorage → initial 그대로", async () => {
    const { plinkoStore } = await import("../persistedGameState");
    const s = plinkoStore.get();
    expect(s.nonce).toBe(0);
    expect(s.rows).toBe(16);
    expect(s.risk).toBe("medium");
    expect(s.pendingAmount).toBe(10);
    expect(s.history).toEqual([]);
    expect(s.lastOutcome).toBeNull();
  });
});

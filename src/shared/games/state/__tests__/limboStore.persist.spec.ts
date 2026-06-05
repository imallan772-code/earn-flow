/**
 * limboStore persist spec — ROUND L-2-pre single-slot 영속 호환성.
 *
 * 시나리오
 *  - localStorage key는 `phonara.gamestate.limbo.v2` (version 2).
 *  - 신규 단일 슬롯 필드(activeRound · lastOutcome) 영속/하이드레이트 확인.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "phonara.gamestate.limbo.v2";
const V1 = "phonara.gamestate.limbo.v1";

describe("limboStore — v2 single-slot persist", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("localStorage key는 v2", async () => {
    const { limboStore } = await import("../persistedGameState");
    limboStore.set((s) => ({ ...s, pendingAmount: 42 }));
    await new Promise((r) => setTimeout(r, 120));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem(V1)).toBeNull();
  });

  it("v2 저장본 그대로 로드 (멀티 슬롯 필드 부재)", async () => {
    const stored = {
      nonce: 12,
      history: [],
      lastOutcome: { outcome: "win", profit: 5, nonce: 11, crashPoint: 2.5, target: 2.0 },
      target: 2.0,
      pendingAmount: 10,
      activeRound: {
        nonce: 11,
        amount: 50,
        target: 2.5,
        liveBetId: "lb_test",
        placedAt: 1700000000000,
      },
      clientSeed: "custom-seed",
      pendingLegacyRefunds: [],
    };
    window.localStorage.setItem(KEY, JSON.stringify(stored));

    const { limboStore } = await import("../persistedGameState");
    const s = limboStore.get();

    expect(s.activeRound?.liveBetId).toBe("lb_test");
    expect(s.activeRound?.target).toBe(2.5);
    expect(s.lastOutcome?.outcome).toBe("win");
    expect(s.clientSeed).toBe("custom-seed");
    expect(s.pendingLegacyRefunds).toEqual([]);
    // 멀티 슬롯 필드 부재
    expect((s as unknown as Record<string, unknown>).activeRounds).toBeUndefined();
    expect((s as unknown as Record<string, unknown>).activeSlot).toBeUndefined();
    expect((s as unknown as Record<string, unknown>).lastOutcomeBySlot).toBeUndefined();
  });

  it("activeRound 갱신 후 persist", async () => {
    const { limboStore } = await import("../persistedGameState");
    limboStore.set((s) => ({
      ...s,
      activeRound: {
        nonce: 1,
        amount: 10,
        target: 2.0,
        liveBetId: "lb_a",
        placedAt: 0,
      },
    }));
    await new Promise((r) => setTimeout(r, 120));
    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.activeRound.liveBetId).toBe("lb_a");
  });
});

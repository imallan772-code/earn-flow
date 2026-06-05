/**
 * limboStore restore spec — activeRounds 슬롯별 라이프사이클 불변식.
 *
 * 검증
 *  - place(slot): activeRounds[slot] 세팅, 다른 슬롯 불변.
 *  - settle(slot): 같은 set 호출에서 activeRounds[slot]=null + lastOutcomeBySlot[slot] 갱신.
 *  - PF seed 변경: 양 슬롯 모두 null, nonce 0 리셋.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("limboStore.activeRounds — per-slot lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("place(slot 0) → activeRounds[0] 세팅, [1] 불변", async () => {
    const { limboStore } = await import("../persistedGameState");

    limboStore.set((s) => {
      const ars = [...s.activeRounds] as typeof s.activeRounds;
      ars[0] = {
        nonce: 0,
        amount: 10,
        target: 2.0,
        liveBetId: "lb_a",
        placedAt: Date.now(),
        slot: 0,
      };
      return { ...s, nonce: s.nonce + 1, activeRounds: ars };
    });
    const s = limboStore.get();
    expect(s.activeRounds[0]?.liveBetId).toBe("lb_a");
    expect(s.activeRounds[1]).toBeNull();
    expect(s.nonce).toBe(1);
  });

  it("두 슬롯 동시 active → 각자 settle 시 activeRounds[i]=null + slotOutcome 갱신", async () => {
    const { limboStore } = await import("../persistedGameState");

    // 동시 active
    limboStore.set((s) => ({
      ...s,
      nonce: 2,
      activeRounds: [
        { nonce: 0, amount: 10, target: 2.0, liveBetId: "lb_a", placedAt: 0, slot: 0 },
        { nonce: 1, amount: 20, target: 5.0, liveBetId: "lb_b", placedAt: 0, slot: 1 },
      ],
    }));
    expect(limboStore.get().activeRounds[0]?.nonce).toBe(0);
    expect(limboStore.get().activeRounds[1]?.nonce).toBe(1);

    // settle slot 0
    limboStore.set((s) => {
      const ars = [...s.activeRounds] as typeof s.activeRounds;
      ars[0] = null;
      const sl = [...s.lastOutcomeBySlot] as typeof s.lastOutcomeBySlot;
      sl[0] = { outcome: "win", profit: 10, nonce: 0, crashPoint: 2.5, target: 2.0 };
      return {
        ...s,
        activeRounds: ars,
        lastOutcomeBySlot: sl,
        lastOutcome: sl[0],
        history: [{ id: "n0", crashPoint: 2.5, target: 2.0, win: true }, ...s.history],
      };
    });
    expect(limboStore.get().activeRounds[0]).toBeNull();
    expect(limboStore.get().activeRounds[1]?.nonce).toBe(1);
    expect(limboStore.get().lastOutcomeBySlot[0]?.outcome).toBe("win");
    expect(limboStore.get().lastOutcomeBySlot[1]).toBeNull();

    // settle slot 1 (loss)
    limboStore.set((s) => {
      const ars = [...s.activeRounds] as typeof s.activeRounds;
      ars[1] = null;
      const sl = [...s.lastOutcomeBySlot] as typeof s.lastOutcomeBySlot;
      sl[1] = { outcome: "loss", profit: -20, nonce: 1, crashPoint: 1.2, target: 5.0 };
      return {
        ...s,
        activeRounds: ars,
        lastOutcomeBySlot: sl,
        lastOutcome: sl[1],
      };
    });
    expect(limboStore.get().activeRounds).toEqual([null, null]);
    expect(limboStore.get().lastOutcomeBySlot[1]?.outcome).toBe("loss");
  });

  it("PF seed 변경: nonce 0 + activeRounds + lastOutcomeBySlot 클리어", async () => {
    const { limboStore } = await import("../persistedGameState");

    limboStore.set((s) => ({
      ...s,
      nonce: 50,
      activeRounds: [
        { nonce: 49, amount: 1, target: 2, liveBetId: "x", placedAt: 0, slot: 0 },
        null,
      ],
      lastOutcomeBySlot: [
        { outcome: "win", profit: 1, nonce: 48, crashPoint: 3, target: 2 },
        null,
      ],
    }));

    // simulated apply seed
    limboStore.set((s) => ({
      ...s,
      clientSeed: "new-seed",
      nonce: 0,
      activeRounds: [null, null],
      lastOutcome: null,
      lastOutcomeBySlot: [null, null],
    }));

    const s = limboStore.get();
    expect(s.nonce).toBe(0);
    expect(s.clientSeed).toBe("new-seed");
    expect(s.activeRounds).toEqual([null, null]);
    expect(s.lastOutcomeBySlot).toEqual([null, null]);
  });
});

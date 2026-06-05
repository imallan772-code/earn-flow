/**
 * limboStore migrate spec — ROUND L-2-pre.
 *
 * v1 multi-slot legacy 저장본 → v2 single-slot 변환:
 *  - parsed.activeRounds non-null 항목 → pendingLegacyRefunds push (실제 refund() RPC
 *    호출 검증은 LimboScreen mount effect 책임. 본 spec은 store 변환만 확인).
 *  - activeRound = null (UI carry-over 없음)
 *  - lastOutcome = lastOutcomeBySlot.find(Boolean) ?? lastOutcome ?? null
 *  - v2 shape는 변환 없이 그대로 머지.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const V1 = "phonara.gamestate.limbo.v1";
const V2 = "phonara.gamestate.limbo.v2";

describe("limboStore — v1 multi-slot → v2 single-slot migrate", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it("양 슬롯 active → pendingLegacyRefunds 2건, activeRound=null", async () => {
    const legacy = {
      nonce: 5,
      history: [],
      lastOutcome: null,
      lastOutcomeBySlot: [null, null],
      target: 2.5,
      pendingAmount: 25,
      activeRounds: [
        { nonce: 3, amount: 10, target: 2.0, liveBetId: "lb_a", placedAt: 0, slot: 0 },
        { nonce: 4, amount: 25, target: 5.0, liveBetId: "lb_b", placedAt: 0, slot: 1 },
      ],
      clientSeed: "legacy-seed",
      activeSlot: 1,
    };
    window.localStorage.setItem(V1, JSON.stringify(legacy));

    const { limboStore } = await import("../persistedGameState");
    const s = limboStore.get();

    expect(s.activeRound).toBeNull();
    expect(s.pendingLegacyRefunds).toHaveLength(2);
    expect(s.pendingLegacyRefunds[0]).toEqual({ amount: 10, nonce: 3 });
    expect(s.pendingLegacyRefunds[1]).toEqual({ amount: 25, nonce: 4 });
    // 기존 필드 보존
    expect(s.nonce).toBe(5);
    expect(s.target).toBe(2.5);
    expect(s.clientSeed).toBe("legacy-seed");
    // 멀티 슬롯 필드 부재
    expect((s as unknown as Record<string, unknown>).activeRounds).toBeUndefined();
    expect((s as unknown as Record<string, unknown>).activeSlot).toBeUndefined();
    expect((s as unknown as Record<string, unknown>).lastOutcomeBySlot).toBeUndefined();
  });

  it("slot[0]만 active → pendingLegacyRefunds 1건", async () => {
    const legacy = {
      nonce: 2,
      history: [],
      lastOutcome: null,
      lastOutcomeBySlot: [
        { outcome: "win", profit: 5, nonce: 1, crashPoint: 2.3, target: 2.0 },
        null,
      ],
      target: 2.0,
      pendingAmount: 10,
      activeRounds: [
        { nonce: 1, amount: 15, target: 2.0, liveBetId: "lb_only", placedAt: 0, slot: 0 },
        null,
      ],
      clientSeed: "phonara-player-001",
      activeSlot: 0,
    };
    window.localStorage.setItem(V1, JSON.stringify(legacy));

    const { limboStore } = await import("../persistedGameState");
    const s = limboStore.get();

    expect(s.activeRound).toBeNull();
    expect(s.pendingLegacyRefunds).toHaveLength(1);
    expect(s.pendingLegacyRefunds[0]).toEqual({ amount: 15, nonce: 1 });
    // lastOutcomeBySlot[0] → lastOutcome 으로 fold
    expect(s.lastOutcome?.outcome).toBe("win");
    expect(s.lastOutcome?.nonce).toBe(1);
  });

  it("v2 shape는 변환 없이 그대로 로드 (pendingLegacyRefunds 빈 배열)", async () => {
    const v2 = {
      nonce: 7,
      history: [],
      lastOutcome: null,
      target: 2.0,
      pendingAmount: 10,
      activeRound: null,
      clientSeed: "phonara-player-001",
      pendingLegacyRefunds: [],
    };
    window.localStorage.setItem(V2, JSON.stringify(v2));
    // v1도 동시에 있어도 v2 우선
    window.localStorage.setItem(V1, JSON.stringify({ activeRounds: [{ amount: 1, nonce: 0 }] }));

    const { limboStore } = await import("../persistedGameState");
    const s = limboStore.get();
    expect(s.nonce).toBe(7);
    expect(s.activeRound).toBeNull();
    expect(s.pendingLegacyRefunds).toEqual([]);
  });

  it("v1/v2 모두 없음 → initial state", async () => {
    const { limboStore } = await import("../persistedGameState");
    const s = limboStore.get();
    expect(s.activeRound).toBeNull();
    expect(s.pendingLegacyRefunds).toEqual([]);
    expect(s.nonce).toBe(0);
  });
});

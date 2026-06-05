/**
 * LimboEngine spec — 6 cases (결정론·경계·승률·payout·극단입력·isWin 경계).
 */
import { describe, expect, it } from "vitest";
import {
  LIMBO_RTP,
  MAX_TARGET,
  MIN_CRASH,
  MIN_TARGET,
  computeCrashPoint,
  isWin,
  payoutMultiplier,
  winChance,
} from "../LimboEngine";

const SEED = { serverSeed: "phonara-limbo-test-server", clientSeed: "player-001", nonce: 7 };

describe("LimboEngine", () => {
  it("computeCrashPoint is deterministic for same (serverSeed, clientSeed, nonce)", async () => {
    const a = await computeCrashPoint(SEED);
    const b = await computeCrashPoint(SEED);
    expect(a).toBe(b);
    // 다른 nonce → 다른 결과 (확률적으로 같을 수 있으나 거의 확실히 다름)
    const c = await computeCrashPoint({ ...SEED, nonce: SEED.nonce + 1 });
    expect(a).not.toBe(c);
  });

  it("crashPoint is always >= 1.00 across many nonces", async () => {
    for (let n = 0; n < 200; n++) {
      const cp = await computeCrashPoint({ ...SEED, nonce: n });
      expect(cp).toBeGreaterThanOrEqual(MIN_CRASH);
      expect(cp).toBeLessThanOrEqual(MAX_TARGET);
    }
  });

  it("target=2.0 win rate approximates 49.5% across 1000 samples (RTP 99%)", async () => {
    const samples = 1000;
    let wins = 0;
    for (let n = 0; n < samples; n++) {
      const cp = await computeCrashPoint({ ...SEED, nonce: n });
      if (isWin(cp, 2.0)) wins++;
    }
    const rate = (wins / samples) * 100;
    // 기대값 49.5%. 1000 샘플의 ±5% 허용 (~99% 신뢰).
    expect(rate).toBeGreaterThan(44);
    expect(rate).toBeLessThan(55);
  });

  it("payoutMultiplier == target (engine RTP baked in winChance, not multiplier)", () => {
    expect(payoutMultiplier(2.0)).toBe(2.0);
    expect(payoutMultiplier(10.5)).toBe(10.5);
    // winChance에 RTP 반영
    expect(winChance(2.0)).toBeCloseTo(LIMBO_RTP * 100 * 0.5, 9); // 49.5
    expect(winChance(10.0)).toBeCloseTo(9.9, 9);
  });

  it("extreme target inputs clamp safely (1.01 .. 1_000_000)", () => {
    expect(payoutMultiplier(0)).toBe(MIN_TARGET);
    expect(payoutMultiplier(-5)).toBe(MIN_TARGET);
    expect(payoutMultiplier(1.005)).toBe(MIN_TARGET);
    expect(payoutMultiplier(1.01)).toBe(1.01);
    expect(payoutMultiplier(MAX_TARGET)).toBe(MAX_TARGET);
    expect(payoutMultiplier(MAX_TARGET + 1)).toBe(MAX_TARGET);
    expect(payoutMultiplier(Number.NaN)).toBe(MIN_TARGET);
  });

  it("isWin treats crashPoint == target as a win (inclusive boundary)", () => {
    expect(isWin(2.0, 2.0)).toBe(true);
    expect(isWin(1.99, 2.0)).toBe(false);
    expect(isWin(2.01, 2.0)).toBe(true);
    expect(isWin(MIN_CRASH, MIN_TARGET)).toBe(false); // 1.0 < 1.01
  });
});

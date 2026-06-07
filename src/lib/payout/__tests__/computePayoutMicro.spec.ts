import { describe, expect, it } from "vitest";
import { settlementPayout } from "@/shared/games/engine/houseEdge";
import {
  computePayoutFromE6,
  computePayoutMicroPhon,
  computePayoutPhon,
  phonToMicro,
} from "@/lib/payout/computePayoutMicro";

describe("GA-K payout SSOT parity (TS ↔ SQL)", () => {
  it("computePayoutPhon matches settlementPayout for real mode", () => {
    const vectors = [
      { bet: 10, mult: 2.0 },
      { bet: 10, mult: 1.5 },
      { bet: 100, mult: 3.33 },
      { bet: 1, mult: 1.01 },
    ];
    for (const v of vectors) {
      expect(computePayoutPhon(v.bet, v.mult)).toBe(settlementPayout(v.bet, v.mult, "real"));
    }
  });

  it("computePayoutFromE6 matches micro path", () => {
    const bet = 100;
    const mult = 2.5;
    const multE6 = Math.round(mult * 1_000_000);
    expect(computePayoutFromE6(bet, multE6)).toBe(250);
    expect(computePayoutMicroPhon(phonToMicro(bet), multE6)).toBe(phonToMicro(250));
  });

  it("boundary: zero bet returns 0", () => {
    expect(computePayoutPhon(0, 10)).toBe(0);
    expect(computePayoutFromE6(0, 2_000_000)).toBe(0);
  });
});

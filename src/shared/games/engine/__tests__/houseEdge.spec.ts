import { describe, expect, it } from "vitest";
import { applyEdge, profitOf, payoutOf, settlementPayout, settlementProfit, RTP } from "../houseEdge";

/**
 * GA-B: RTP 1.00 at mode layer. Effective 99% is in engine only.
 * demo=real at this layer → settlement formulas are identical for both modes.
 */
describe("houseEdge (GA-B: RTP 1.00)", () => {
  it("demo RTP is 1.00 — no extra edge at mode layer", () => {
    expect(RTP.demo).toBe(1.00);
    expect(applyEdge(2.0, "demo")).toBeCloseTo(2.0, 6);
  });

  it("real RTP is 1.00 — no extra edge at mode layer", () => {
    expect(RTP.real).toBe(1.00);
    expect(applyEdge(2.0, "real")).toBeCloseTo(2.0, 6);
  });

  it("demo and real produce identical applyEdge results", () => {
    expect(applyEdge(3.5, "demo")).toBe(applyEdge(3.5, "real"));
  });

  it("profitOf: demo 2x on 10 = +10 (full payout, engine handles 99%)", () => {
    expect(profitOf(10, 2.0, "demo")).toBeCloseTo(10, 6);
  });

  it("profitOf: real 2x on 10 = +10", () => {
    expect(profitOf(10, 2.0, "real")).toBeCloseTo(10, 6);
  });

  it("payoutOf: real 2x on 10 = 20", () => {
    expect(payoutOf(10, 2.0, "real")).toBeCloseTo(20, 6);
  });

  it("settlementPayout: real rounds to nearest integer PHON", () => {
    expect(settlementPayout(10, 2.0, "real")).toBe(20);
    expect(settlementPayout(10, 1.5, "real")).toBe(15);
  });

  it("settlementPayout: demo keeps float precision", () => {
    expect(settlementPayout(10, 2.0, "demo")).toBeCloseTo(20, 6);
    expect(settlementPayout(7, 1.5, "demo")).toBeCloseTo(10.5, 6);
  });

  it("settlementProfit matches payout minus stake", () => {
    expect(settlementProfit(10, 2.0, "real")).toBe(10);
    expect(settlementProfit(10, 0.5, "real")).toBe(-5);
  });

  it("settlement: 1x (break-even) returns bet amount", () => {
    expect(settlementPayout(100, 1.0, "real")).toBe(100);
    expect(settlementProfit(100, 1.0, "real")).toBe(0);
  });
});

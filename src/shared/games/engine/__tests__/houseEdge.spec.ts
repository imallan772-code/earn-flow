import { describe, expect, it } from "vitest";
import { applyEdge, profitOf, payoutOf, RTP } from "../houseEdge";

describe("houseEdge", () => {
  it("demo applies 3% edge (same as real)", () => {
    expect(applyEdge(2.0, "demo")).toBeCloseTo(1.94, 6);
    expect(RTP.demo).toBeCloseTo(0.97, 6);
  });

  it("real applies 3% edge", () => {
    expect(applyEdge(2.0, "real")).toBeCloseTo(1.94, 6);
    expect(RTP.real).toBeCloseTo(0.97, 6);
  });

  it("profitOf: demo 2x on 10 = +9.4", () => {
    expect(profitOf(10, 2.0, "demo")).toBeCloseTo(9.4, 6);
  });

  it("profitOf: real 2x on 10 = +9.4", () => {
    expect(profitOf(10, 2.0, "real")).toBeCloseTo(9.4, 6);
  });

  it("payoutOf: real 2x on 10 = 19.4", () => {
    expect(payoutOf(10, 2.0, "real")).toBeCloseTo(19.4, 6);
  });
});

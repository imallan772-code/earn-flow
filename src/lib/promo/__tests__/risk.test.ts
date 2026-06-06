import { describe, expect, it } from "vitest";
import { scanRiskLocal } from "@/lib/promo/risk";

describe("risk", () => {
  it("low for benign", () => {
    const r = scanRiskLocal("Hello world, normal promo");
    expect(r.level).toBe("low");
    expect(r.score).toBeLessThan(25);
  });
  it("high on jackpot keyword", () => {
    const r = scanRiskLocal("원금보장 100% 확정수익");
    expect(r.level).toBe("high");
    expect(r.flags.length).toBeGreaterThan(0);
  });
  it("caps at 100", () => {
    const r = scanRiskLocal("guaranteed 100% 보장 도박 casino free money 원금보장");
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

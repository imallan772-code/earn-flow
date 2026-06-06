import { describe, expect, it } from "vitest";
import { mergeRiskScores, scanRiskLocal, levelFromScore } from "@/lib/promo/risk";

describe("mergeRiskScores", () => {
  it("returns local when ai is null", () => {
    const local = scanRiskLocal("hello");
    const r = mergeRiskScores(local, null);
    expect(r).toEqual(local);
  });

  it("max score wins", () => {
    const local = { score: 20, flags: ["foo"], level: "low" as const };
    const r = mergeRiskScores(local, { score: 70, flags: ["bar"] });
    expect(r.score).toBe(70);
    expect(r.level).toBe("high");
  });

  it("flag union deduplicates", () => {
    const local = { score: 30, flags: ["보장"], level: "medium" as const };
    const r = mergeRiskScores(local, { score: 30, flags: ["보장", "공짜"] });
    expect(r.flags).toEqual(["보장", "공짜"]);
  });

  it("level matches 25/60 thresholds", () => {
    expect(levelFromScore(0).toString()).toBe("low");
    expect(levelFromScore(24)).toBe("low");
    expect(levelFromScore(25)).toBe("medium");
    expect(levelFromScore(59)).toBe("medium");
    expect(levelFromScore(60)).toBe("high");
    expect(levelFromScore(100)).toBe("high");
  });

  it("clamps merged score to 0-100", () => {
    const local = { score: 50, flags: [], level: "medium" as const };
    const r = mergeRiskScores(local, { score: 250, flags: [] });
    expect(r.score).toBe(100);
  });

  it("rounds ai fractional score", () => {
    const local = { score: 10, flags: [], level: "low" as const };
    const r = mergeRiskScores(local, { score: 33.7, flags: [] });
    expect(r.score).toBe(34);
  });
});

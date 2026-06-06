import { describe, expect, it } from "vitest";
import { pickVariant, splitVariants } from "@/lib/promo/abSplit";

describe("abSplit", () => {
  it("sums to 1", () => {
    const s = splitVariants([
      { id: "a", weight: 1, payload: 1 },
      { id: "b", weight: 3, payload: 2 },
    ]);
    const sum = s.reduce((x, v) => x + v.ratio, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(s[0].ratio).toBeCloseTo(0.25, 5);
  });
  it("equal split on zero weights", () => {
    const s = splitVariants([
      { id: "a", weight: 0, payload: 1 },
      { id: "b", weight: 0, payload: 2 },
    ]);
    expect(s[0].ratio).toBeCloseTo(0.5);
  });
  it("pickVariant deterministic", () => {
    const v = pickVariant(
      [
        { id: "a", weight: 1, payload: "A" },
        { id: "b", weight: 1, payload: "B" },
      ],
      0.1,
    );
    expect(v?.id).toBe("a");
    const v2 = pickVariant(
      [
        { id: "a", weight: 1, payload: "A" },
        { id: "b", weight: 1, payload: "B" },
      ],
      0.9,
    );
    expect(v2?.id).toBe("b");
  });
});

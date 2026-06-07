import { describe, expect, it } from "vitest";
import { phonToMicro } from "../computePayoutMicro";

const MICRO = 1_000_000;

describe("phon micro invariant (GA-L)", () => {
  it("phonToMicro matches SQL money_phon_micro_unit", () => {
    expect(phonToMicro(0)).toBe(0);
    expect(phonToMicro(100)).toBe(100 * MICRO);
    expect(phonToMicro(1_234_567)).toBe(1_234_567 * MICRO);
  });
});

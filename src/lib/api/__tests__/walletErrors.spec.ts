import { describe, expect, it } from "vitest";
import { isBenignRefundError } from "../walletErrors";

describe("isBenignRefundError", () => {
  it("treats missing round / already settled as benign", () => {
    expect(isBenignRefundError({ message: "MONEY_ROUND_NOT_FOUND" })).toBe(true);
    expect(isBenignRefundError({ message: "MONEY_ROUND_ALREADY_SETTLED" })).toBe(true);
    expect(isBenignRefundError(new Error("network timeout"))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { toIntegerPhonAmount, walletBetInputSchema } from "../walletSchemas";

describe("walletBetInputSchema", () => {
  it("accepts valid bet input", () => {
    const r = walletBetInputSchema.parse({ amount: 100, game: "dice", roundId: "r-1" });
    expect(r.game).toBe("dice");
  });

  it("rejects empty game", () => {
    expect(() => walletBetInputSchema.parse({ amount: 1, game: "", roundId: "x" })).toThrow();
  });

  it("rejects oversized roundId", () => {
    expect(() =>
      walletBetInputSchema.parse({ amount: 1, game: "crash", roundId: "x".repeat(129) }),
    ).toThrow();
  });

  it("AC-3: rejects non-integer amount", () => {
    expect(() => walletBetInputSchema.parse({ amount: 0.49, game: "dice", roundId: "n1" })).toThrow();
    expect(() => walletBetInputSchema.parse({ amount: 1.5, game: "dice", roundId: "n1" })).toThrow();
  });

  it("rejects amount below minimum PHON bet", () => {
    expect(() => walletBetInputSchema.parse({ amount: 0, game: "dice", roundId: "n1" })).toThrow();
  });
});

describe("toIntegerPhonAmount", () => {
  it("AC-3: returns null for sub-unit fractional amounts", () => {
    expect(toIntegerPhonAmount(0.49)).toBeNull();
    expect(toIntegerPhonAmount(0.51)).toBeNull();
  });

  it("accepts positive integers >= 1", () => {
    expect(toIntegerPhonAmount(1)).toBe(1);
    expect(toIntegerPhonAmount(100)).toBe(100);
  });
});

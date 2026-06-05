import { describe, expect, it } from "vitest";
import { walletBetInputSchema } from "../walletSchemas";

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
});

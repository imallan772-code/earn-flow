import { describe, it, expect } from "vitest";
import { applyFeedFilter, BIG_WIN_MULTIPLIER } from "../feedFilter";
import type { LiveBet } from "../LiveBetsStore";

function bet(over: Partial<LiveBet>): LiveBet {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    user: "u",
    game: "crash",
    amount: 10,
    multiplier: null,
    profit: null,
    status: "pending",
    mode: "real",
    ts: Date.now(),
    ...over,
  };
}

describe("applyFeedFilter", () => {
  const data: LiveBet[] = [
    bet({ id: "a", status: "win", multiplier: BIG_WIN_MULTIPLIER, profit: 90 }),
    bet({ id: "b", status: "cashout", multiplier: BIG_WIN_MULTIPLIER + 5, profit: 150 }),
    bet({ id: "c", status: "win", multiplier: 2, profit: 10 }),
    bet({ id: "d", status: "bust", multiplier: null, profit: -10 }),
    bet({ id: "me", isMe: true, status: "pending" }),
    bet({ id: "me2", isMe: true, status: "win", multiplier: 50, profit: 490 }),
  ];

  it("all returns input as-is", () => {
    expect(applyFeedFilter(data, "all")).toEqual(data);
  });

  it("big wins keeps win/cashout with multiplier >= 10", () => {
    const out = applyFeedFilter(data, "big").map((b) => b.id);
    expect(out).toEqual(["a", "b", "me2"]);
  });

  it("me only keeps isMe rows", () => {
    const out = applyFeedFilter(data, "me").map((b) => b.id);
    expect(out).toEqual(["me", "me2"]);
  });
});

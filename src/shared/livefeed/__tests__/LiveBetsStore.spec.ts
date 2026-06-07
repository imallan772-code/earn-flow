import { describe, expect, it, beforeEach } from "vitest";
import { liveBetsStore, orderLiveBetsForView } from "../LiveBetsStore";

describe("liveBetsStore", () => {
  beforeEach(() => {
    liveBetsStore.__reset();
  });

  it("settle re-inserts ME row when id missing from buffer", () => {
    const id = "lb_test_me";
    liveBetsStore.settle(
      id,
      { multiplier: 2.5, profit: 15, status: "cashout" },
      {
        user: "나의_베팅",
        game: "crash",
        amount: 10,
        multiplier: null,
        profit: null,
        status: "pending",
        mode: "demo",
        isMe: true,
      },
    );
    const row = liveBetsStore.getSnapshot().find((b) => b.id === id);
    expect(row?.status).toBe("cashout");
    expect(row?.profit).toBe(15);
    expect(row?.multiplier).toBe(2.5);
  });

  it("ensureUserPending upserts by id after buffer reset", () => {
    const id = "lb_restore";
    liveBetsStore.ensureUserPending({
      id,
      user: "나의_베팅",
      game: "crash",
      amount: 10,
      multiplier: null,
      profit: null,
      status: "pending",
      mode: "demo",
      isMe: true,
    });
    liveBetsStore.__reset();
    liveBetsStore.ensureUserPending({
      id,
      user: "나의_베팅",
      game: "crash",
      amount: 10,
      multiplier: null,
      profit: null,
      status: "pending",
      mode: "demo",
      isMe: true,
    });
    expect(liveBetsStore.getSnapshot().some((b) => b.id === id && b.isMe)).toBe(true);
  });

  it("new ME pending cancels previous ME pending for same game", () => {
    const a = liveBetsStore.push({
      user: "나의_베팅",
      game: "crash",
      amount: 5,
      multiplier: null,
      profit: null,
      status: "pending",
      mode: "demo",
      isMe: true,
    });
    liveBetsStore.push({
      user: "나의_베팅",
      game: "crash",
      amount: 10,
      multiplier: null,
      profit: null,
      status: "pending",
      mode: "demo",
      isMe: true,
    });
    const old = liveBetsStore.getSnapshot().find((b) => b.id === a);
    expect(old?.status).toBe("bust");
  });
});

describe("orderLiveBetsForView", () => {
  it("pins pending ME rows ahead of bot bets", () => {
    const ordered = orderLiveBetsForView(
      [
        {
          id: "1",
          user: "bot",
          game: "crash",
          amount: 100,
          multiplier: 2,
          profit: 50,
          status: "cashout",
          mode: "real",
          ts: 3,
        },
        {
          id: "2",
          user: "나의_베팅",
          game: "crash",
          amount: 10,
          multiplier: null,
          profit: null,
          status: "pending",
          mode: "demo",
          isMe: true,
          ts: 2,
        },
      ],
      "crash",
    );
    expect(ordered[0]?.id).toBe("2");
  });

  it("interleaves settled ME rows with bot bets by recency", () => {
    const ordered = orderLiveBetsForView([
      {
        id: "old-me",
        user: "나의_베팅",
        game: "dice",
        amount: 1,
        multiplier: 2,
        profit: 1,
        status: "win",
        mode: "real",
        isMe: true,
        ts: 1,
      },
      {
        id: "fresh-bot",
        user: "Toro***",
        game: "crash",
        amount: 50,
        multiplier: 3,
        profit: 100,
        status: "cashout",
        mode: "real",
        ts: 100,
      },
      {
        id: "stale-bot",
        user: "Kai***",
        game: "plinko",
        amount: 20,
        multiplier: 1.5,
        profit: 10,
        status: "win",
        mode: "demo",
        ts: 50,
      },
    ]);
    expect(ordered.map((b) => b.id)).toEqual(["fresh-bot", "stale-bot", "old-me"]);
  });
});

import { describe, it, expect } from "vitest";
import { liveFeedBetIdForRound, mapLiveBetRow } from "../liveFeedMap";
import type { LiveBetRow } from "../liveFeedSchemas";

const baseRow: LiveBetRow = {
  id: "00000000-0000-4000-8000-000000000001",
  event_key: "crash:n42",
  user_id: "11111111-1111-4111-8111-111111111111",
  display_name: "Player_ABCDEF",
  game: "crash",
  amount: 100,
  multiplier: 2.5,
  profit: 150,
  status: "cashout",
  mode: "real",
  created_at: "2026-06-06T00:00:00.000Z",
  updated_at: "2026-06-06T00:00:01.000Z",
};

describe("liveFeedMap", () => {
  it("liveFeedBetIdForRound matches event_key id convention", () => {
    expect(liveFeedBetIdForRound("crash", "n42")).toBe("live:crash:n42");
  });

  it("maps remote row for other user", () => {
    const bet = mapLiveBetRow(baseRow, "22222222-2222-4222-8222-222222222222");
    expect(bet).toMatchObject({
      id: "live:crash:n42",
      user: "Player_ABCDEF",
      game: "crash",
      amount: 100,
      isMe: undefined,
    });
  });

  it("maps own row with ME label", () => {
    const bet = mapLiveBetRow(baseRow, baseRow.user_id ?? null);
    expect(bet?.user).toBe("나의_베팅");
    expect(bet?.isMe).toBe(true);
  });

  it("skips unknown games", () => {
    expect(mapLiveBetRow({ ...baseRow, game: "unknown" }, null)).toBeNull();
  });
});

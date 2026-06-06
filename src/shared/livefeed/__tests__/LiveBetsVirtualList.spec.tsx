import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveBetsVirtualList } from "../LiveBetsVirtualList";
import { liveBetsStore, type LiveBet } from "../LiveBetsStore";

function makeBet(i: number, overrides: Partial<LiveBet> = {}): LiveBet {
  return {
    id: `lb_${i}`,
    user: `user_${i}`,
    game: "crash",
    amount: 10 + i,
    multiplier: 2,
    profit: 10,
    status: "cashout",
    mode: "real",
    ts: Date.now() + i,
    ...overrides,
  };
}

describe("LiveBetsVirtualList", () => {
  beforeEach(() => liveBetsStore.__reset());

  it("renders empty state when no bets", () => {
    render(<LiveBetsVirtualList bets={[]} height={200} />);
    expect(screen.getByText("베팅 대기 중...")).toBeTruthy();
  });

  it("renders rows for provided bets (windowed)", () => {
    const bets = Array.from({ length: 500 }, (_, i) => makeBet(i));
    render(<LiveBetsVirtualList bets={bets} height={200} />);
    // first few rows should be present; tail row index 499 should be windowed-out
    expect(screen.getByText("user_0")).toBeTruthy();
    expect(screen.queryByText("user_499")).toBeNull();
  });
});

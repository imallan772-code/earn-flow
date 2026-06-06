import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameCard3D } from "../GameCard3D";
import { GameMiniStats } from "../GameMiniStats";
import { getGameById, gamePath } from "@/shared/games/registry/gameRegistry";

describe("GameCard3D", () => {
  it("renders closed game as static tile (no link wrapper)", () => {
    const slots = getGameById("slots")!;
    render(<GameCard3D card={slots} />);
    expect(screen.getByText("Slots")).toBeTruthy();
    expect(screen.getByText("SOON")).toBeTruthy();
    expect(document.querySelector('a[data-game-card="slots"]')).toBeNull();
    expect(document.querySelector('div[data-game-card="slots"]')).not.toBeNull();
  });

  it("open game registry entries resolve to a Link path", () => {
    const crash = getGameById("crash")!;
    expect(crash.open).toBe(true);
    expect(gamePath(crash.id)).toBe("/games/crash");
  });
});

describe("GameMiniStats", () => {
  it("renders fallback dashed line when no series", () => {
    const { container } = render(<GameMiniStats game="crash" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

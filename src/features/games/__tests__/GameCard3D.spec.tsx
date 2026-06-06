import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
} from "@tanstack/react-router";
import { GameCard3D } from "../GameCard3D";
import { getGameById } from "@/shared/games/registry/gameRegistry";

function renderWithRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{ui}</>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("GameCard3D", () => {
  it("renders open game with LIVE badge and link wrapper", async () => {
    const crash = getGameById("crash")!;
    renderWithRouter(<GameCard3D card={crash} />);
    await waitFor(() => expect(screen.getByText("Crash")).toBeTruthy());
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(document.querySelector('a[data-game-card="crash"]')).not.toBeNull();
  });

  it("renders closed game without link wrapper", async () => {
    const slots = getGameById("slots")!;
    renderWithRouter(<GameCard3D card={slots} />);
    await waitFor(() => expect(screen.getByText("SOON")).toBeTruthy());
    expect(document.querySelector('a[data-game-card="slots"]')).toBeNull();
    expect(document.querySelector('div[data-game-card="slots"]')).not.toBeNull();
  });
});

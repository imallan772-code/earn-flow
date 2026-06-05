import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameLayoutProvider } from "../GameLayoutProvider";
import { useGameLayout, useRegisterMainMode } from "../useGameLayout";

function MainModeProbe() {
  const { mainMode } = useGameLayout();
  return <span data-testid="main-mode">{mainMode}</span>;
}

function FeedPage() {
  useRegisterMainMode("feed");
  return null;
}

describe("useRegisterMainMode", () => {
  it("defaults to mobile", () => {
    render(
      <GameLayoutProvider>
        <MainModeProbe />
      </GameLayoutProvider>,
    );
    expect(screen.getByTestId("main-mode").textContent).toBe("mobile");
  });

  it("registers feed mode while mounted", () => {
    render(
      <GameLayoutProvider>
        <FeedPage />
        <MainModeProbe />
      </GameLayoutProvider>,
    );
    expect(screen.getByTestId("main-mode").textContent).toBe("feed");
  });

  it("resets to mobile on unmount", () => {
    const { rerender } = render(
      <GameLayoutProvider>
        <FeedPage />
        <MainModeProbe />
      </GameLayoutProvider>,
    );
    expect(screen.getByTestId("main-mode").textContent).toBe("feed");

    rerender(
      <GameLayoutProvider>
        <MainModeProbe />
      </GameLayoutProvider>,
    );
    expect(screen.getByTestId("main-mode").textContent).toBe("mobile");
  });
});

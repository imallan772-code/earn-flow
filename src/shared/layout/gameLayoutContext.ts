import { createContext, useContext, type ReactNode } from "react";

/** DesktopShell `<main>` max-width mode (≥1024). Default: mobile. */
export type MainMode = "mobile" | "feed" | "game";

export interface GameLayoutContextValue {
  mainMode: MainMode;
  setMainMode: (mode: MainMode) => void;
  rightRail: ReactNode | null;
  setRightRail: (node: ReactNode | null) => void;
}

export const GameLayoutContext = createContext<GameLayoutContextValue | null>(null);

export function useGameLayoutContext(): GameLayoutContextValue {
  const ctx = useContext(GameLayoutContext);
  if (!ctx) {
    throw new Error("useGameLayout must be used within GameLayoutProvider.");
  }
  return ctx;
}

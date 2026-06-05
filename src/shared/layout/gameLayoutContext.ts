import { createContext, useContext, type ReactNode } from "react";

export interface GameLayoutContextValue {
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

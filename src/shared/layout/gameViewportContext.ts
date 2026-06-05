import { createContext, useContext, type ReactNode, type RefObject } from "react";

export const GameViewportRefContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useGameViewportRef(): RefObject<HTMLElement | null> | null {
  return useContext(GameViewportRefContext);
}

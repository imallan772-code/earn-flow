import type { ReactNode, RefObject } from "react";
import { GameViewportRefContext } from "./gameViewportContext";

export function GameViewportProvider({
  viewportRef,
  children,
}: {
  viewportRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <GameViewportRefContext.Provider value={viewportRef}>
      {children}
    </GameViewportRefContext.Provider>
  );
}

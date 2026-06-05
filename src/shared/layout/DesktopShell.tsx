/**
 * DesktopShell — ≥1024: sidebar | main (max-width) | optional rightRail.
 * <1024: 모바일 max-w-md 단일 컬럼.
 */
import { useRef, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { GameViewportProvider } from "./GameViewportProvider";
import { RightRail } from "./RightRail";

export function DesktopShell({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLElement>(null);

  return (
    <GameViewportProvider viewportRef={viewportRef}>
      <div className="flex min-h-dvh w-full flex-col lg:flex-row">
        <AppSidebar />
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col safe-top lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1">
          <main
            ref={viewportRef}
            className="mx-auto w-full max-w-md flex-1 px-4 pb-6 pt-3 lg:max-w-4xl lg:px-6 lg:pb-4"
            data-game-viewport
          >
            {children}
          </main>
          <div className="lg:hidden">
            <BottomNav />
          </div>
        </div>
        <RightRail />
      </div>
    </GameViewportProvider>
  );
}

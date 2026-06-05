/**
 * DesktopShell — ≥1024: sidebar | main (mode max-width) | optional rightRail.
 * <1024: 모바일 max-w-md 단일 컬럼.
 * mainMode: mobile (default) | feed | game — Screen에서 useRegisterMainMode로 등록.
 */
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { GameViewportProvider } from "./GameViewportProvider";
import { RightRail } from "./RightRail";
import { useGameLayout } from "./useGameLayout";
import type { MainMode } from "./gameLayoutContext";

const MAIN_LG_MAX: Record<MainMode, string> = {
  mobile: "lg:max-w-md",
  feed: "lg:max-w-2xl",
  game: "lg:max-w-4xl",
};

export function DesktopShell({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLElement>(null);
  const { mainMode } = useGameLayout();

  return (
    <GameViewportProvider viewportRef={viewportRef}>
      <div className="flex min-h-dvh w-full flex-col lg:flex-row">
        <AppSidebar />
        <div className="mx-auto flex h-dvh min-h-0 w-full max-w-md flex-col safe-top lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1">
          <main
            ref={viewportRef}
            className={cn(
              "mx-auto w-full max-w-md min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-4 pt-3 lg:px-6",
              MAIN_LG_MAX[mainMode],
            )}
            data-game-viewport
          >
            {children}
          </main>
          <div className="shrink-0 lg:hidden">
            <BottomNav />
          </div>
        </div>
        <RightRail />
      </div>
    </GameViewportProvider>
  );
}

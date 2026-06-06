/**
 * GameLobby — earn tab game grid (SSOT: gameRegistry).
 *
 * Cards delegate visual + interaction to <GameCard3D/>; the lobby owns layout
 * + keyboard navigation (↑↓←→ to move focus, Enter to follow link).
 */
import { useCallback, useEffect, useRef } from "react";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { GAME_REGISTRY } from "@/shared/games/registry/gameRegistry";
import { useHotkeys } from "@/shared/hooks/useHotkeys";
import { GameCard3D } from "./GameCard3D";

const COLS = 2;

export function GameLobby() {
  const gridRef = useRef<HTMLDivElement | null>(null);

  const focusByOffset = useCallback((offset: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-game-card]"));
    if (cards.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? cards.indexOf(active) : -1;
    const next =
      currentIndex < 0 ? 0 : Math.min(cards.length - 1, Math.max(0, currentIndex + offset));
    cards[next]?.focus();
  }, []);

  useHotkeys({
    ArrowDown: (e) => {
      if (!gridRef.current?.contains(document.activeElement)) return;
      e.preventDefault();
      focusByOffset(COLS);
    },
    ArrowUp: (e) => {
      if (!gridRef.current?.contains(document.activeElement)) return;
      e.preventDefault();
      focusByOffset(-COLS);
    },
    ArrowRight: (e) => {
      if (!gridRef.current?.contains(document.activeElement)) return;
      e.preventDefault();
      focusByOffset(1);
    },
    ArrowLeft: (e) => {
      if (!gridRef.current?.contains(document.activeElement)) return;
      e.preventDefault();
      focusByOffset(-1);
    },
  });

  // Make first card tabbable; Enter is the browser default on Links.
  useEffect(() => {
    const first = gridRef.current?.querySelector<HTMLElement>("[data-game-card]");
    if (first && first.tabIndex < 0) first.tabIndex = 0;
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-(--color-muted)">
          현재 모드
        </span>
        <ModeBadge />
      </div>
      <div ref={gridRef} className="grid grid-cols-2 gap-2.5" role="grid">
        {GAME_REGISTRY.map((g, i) => (
          <GameCard3D key={g.id} card={g} tabIndex={i === 0 ? 0 : -1} />
        ))}
      </div>
    </div>
  );
}

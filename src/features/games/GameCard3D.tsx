/**
 * GameCard3D — Lobby card with subtle tilt, accent glow, status badge, sparkline.
 *
 * - useTilt is reduced-motion / SSR safe.
 * - Wraps in Link when the game is open; otherwise renders a static tile.
 * - Game accent comes from `GAME_REGISTRY` (cyan / gold / emerald / purple / pink / warning).
 */
import { forwardRef } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useTilt } from "@/shared/hooks/useTilt";
import { gamePath, type GameRegistryEntry } from "@/shared/games/registry/gameRegistry";
import { GameMiniStats } from "./GameMiniStats";
import type { LiveGame } from "@/shared/livefeed/LiveBetsStore";

interface Props {
  card: GameRegistryEntry;
  focusable?: boolean;
  tabIndex?: number;
}

const KNOWN_LIVE_GAMES = new Set<LiveGame>([
  "crash",
  "dice",
  "plinko",
  "slots",
  "mines",
  "roulette",
  "limbo",
  "wheel",
]);

export const GameCard3D = forwardRef<HTMLAnchorElement | HTMLDivElement, Props>(function GameCard3D(
  { card, focusable = true, tabIndex },
  forwardedRef,
) {
  const tiltRef = useTilt<HTMLDivElement>(6);
  const accent = `var(--color-${card.accent})`;
  const liveGame = KNOWN_LIVE_GAMES.has(card.id as LiveGame) ? (card.id as LiveGame) : null;

  const inner = (
    <div
      ref={tiltRef}
      className={cn(
        "glass-2 relative flex flex-col gap-2 rounded-2xl p-3 transition-[box-shadow,transform] duration-200 will-change-transform",
        "hover:shadow-[0_8px_28px_-12px_var(--tw-shadow-color)]",
        card.open ? "active:scale-[0.98]" : "opacity-60",
      )}
      style={{ ["--tw-shadow-color" as string]: accent }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 hover:opacity-100"
        style={{
          background: `radial-gradient(120% 60% at 50% 0%, color-mix(in oklab, ${accent} 18%, transparent), transparent 70%)`,
        }}
      />
      <div className="relative flex items-center justify-between">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{
            background: `color-mix(in oklab, ${accent} 18%, transparent)`,
            color: accent,
          }}
        >
          <card.Icon size={20} />
        </div>
        {card.open ? (
          <span className="rounded-full bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald">
            LIVE
          </span>
        ) : (
          <span className="rounded-full bg-(--color-surface-hi) px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
            SOON
          </span>
        )}
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-extrabold">{card.name}</div>
          <div className="font-numeric text-[10px] text-(--color-muted)">
            RTP {card.rtp} · {card.liveBets > 0 ? `${card.liveBets} live` : "준비중"}
          </div>
        </div>
        {liveGame && card.open && (
          <GameMiniStats game={liveGame} accent={accent} width={56} height={16} />
        )}
      </div>
    </div>
  );

  const path = gamePath(card.id);
  if (!path) {
    return (
      <div
        ref={forwardedRef as React.Ref<HTMLDivElement>}
        data-game-card={card.id}
        tabIndex={focusable ? (tabIndex ?? -1) : undefined}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-cyan)_60%,transparent)] rounded-2xl"
      >
        {inner}
      </div>
    );
  }
  return (
    <Link
      ref={forwardedRef as React.Ref<HTMLAnchorElement>}
      to={path}
      data-game-card={card.id}
      tabIndex={focusable ? (tabIndex ?? 0) : -1}
      className="block outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-cyan)_60%,transparent)] rounded-2xl"
    >
      {inner}
    </Link>
  );
});

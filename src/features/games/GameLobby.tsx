/**
 * GameLobby — earn tab game grid (SSOT: gameRegistry).
 */
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import {
  GAME_REGISTRY,
  gamePath,
  type GameRegistryEntry,
} from "@/shared/games/registry/gameRegistry";

export function GameLobby() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          현재 모드
        </span>
        <ModeBadge />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {GAME_REGISTRY.map((g) => (
          <GameTile key={g.id} card={g} />
        ))}
      </div>
    </div>
  );
}

function GameTile({ card }: { card: GameRegistryEntry }) {
  const inner = (
    <div
      className={cn(
        "glass-2 relative flex flex-col gap-2 rounded-2xl p-3 transition active:scale-[0.98]",
        !card.open && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{
            background: `color-mix(in oklab, var(--color-${card.accent}) 18%, transparent)`,
            color: `var(--color-${card.accent})`,
          }}
        >
          <card.Icon size={20} />
        </div>
        {card.open ? (
          <span className="rounded-full bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-emerald)]">
            LIVE
          </span>
        ) : (
          <span className="rounded-full bg-[var(--color-surface-hi)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            SOON
          </span>
        )}
      </div>
      <div>
        <div className="text-sm font-extrabold">{card.name}</div>
        <div className="font-numeric text-[10px] text-[var(--color-muted)]">
          RTP {card.rtp} · {card.liveBets > 0 ? `${card.liveBets} live` : "준비중"}
        </div>
      </div>
    </div>
  );

  const path = gamePath(card.id);
  if (!path) return inner;
  return (
    <Link to={path} className="block">
      {inner}
    </Link>
  );
}

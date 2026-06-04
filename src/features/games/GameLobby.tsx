/**
 * GameLobby — 8-game grid for the Earn tab.
 *
 * Crash / Dice: OPEN — clickable
 * Others: SOON — disabled badge
 */
import { Link } from "@tanstack/react-router";
import { Rocket, Dices, Cherry, CircleDot, Hand, Gift, Layers, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeBadge } from "@/shared/mode/ModeToggle";

type GameId = "crash" | "dice" | "slots" | "roulette" | "rps" | "luckybox" | "cardflip" | "keepy";

interface GameCard {
  id: GameId;
  name: string;
  rtp: string;
  liveBets: number;
  Icon: typeof Rocket;
  open: boolean;
  accent: "cyan" | "gold" | "emerald" | "purple" | "pink" | "warning";
}

const GAMES: GameCard[] = [
  { id: "crash", name: "Crash", rtp: "99%", liveBets: 482, Icon: Rocket, open: true, accent: "cyan" },
  { id: "dice", name: "Dice", rtp: "99%", liveBets: 311, Icon: Dices, open: true, accent: "emerald" },
  { id: "slots", name: "Slots", rtp: "96%", liveBets: 0, Icon: Cherry, open: false, accent: "pink" },
  { id: "roulette", name: "Roulette", rtp: "97.3%", liveBets: 0, Icon: CircleDot, open: false, accent: "warning" },
  { id: "rps", name: "RPS", rtp: "98%", liveBets: 0, Icon: Hand, open: false, accent: "purple" },
  { id: "luckybox", name: "LuckyBox", rtp: "95%", liveBets: 0, Icon: Gift, open: false, accent: "gold" },
  { id: "cardflip", name: "CardFlip", rtp: "98%", liveBets: 0, Icon: Layers, open: false, accent: "cyan" },
  { id: "keepy", name: "Keepy-Uppy", rtp: "—", liveBets: 0, Icon: Trophy, open: false, accent: "emerald" },
];

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
        {GAMES.map((g) => (
          <GameTile key={g.id} card={g} />
        ))}
      </div>
    </div>
  );
}

function GameTile({ card }: { card: GameCard }) {
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

  if (!card.open) return inner;
  if (card.id === "crash")
    return (
      <Link to="/games/crash" className="block">
        {inner}
      </Link>
    );
  if (card.id === "dice")
    return (
      <Link to="/games/dice" className="block">
        {inner}
      </Link>
    );
  return inner;
}

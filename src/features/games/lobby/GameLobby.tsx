import { Link } from "@tanstack/react-router";
import { Rocket, Hand, CircleDot, Gift, RotateCw, Layers, type LucideIcon } from "lucide-react";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { OnlineCounterChip } from "@/shared/layout/OnlineCounterChip";
import { MOCK_GAMES, type GameSlug } from "@/mocks/games";

const ICON: Record<GameSlug, LucideIcon> = {
  crash: Rocket,
  rps: Hand,
  slots: CircleDot,
  "lucky-box": Gift,
  roulette: RotateCw,
  "card-flip": Layers,
};

const ACCENT: Record<GameSlug, "cyan" | "purple" | "pink" | "gold"> = {
  crash: "cyan",
  rps: "pink",
  slots: "gold",
  "lucky-box": "purple",
  roulette: "pink",
  "card-flip": "cyan",
};

export function GameLobby() {
  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="🎮 LOBBY"
        title="6게임 · 폭주"
        description="실시간 32만 명 플레이 중"
        right={<OnlineCounterChip compact />}
      />
      <LiveCashoutStrip />
      <div className="grid grid-cols-2 gap-2.5">
        {MOCK_GAMES.map((g) => {
          const Icon = ICON[g.slug];
          return (
            <Link
              key={g.slug}
              to="/earn/games/$slug"
              params={{ slug: g.slug }}
              className="block"
            >
              <Premium3DCard glow={ACCENT[g.slug]} interactive className="p-4 w-full">
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      background: "color-mix(in oklab, var(--color-cyan) 12%, transparent)",
                      color: "var(--color-cyan)",
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-emerald)]">
                    <span className="inline-block h-1.5 w-1.5 animate-phon-pulse rounded-full bg-current" />
                    LIVE
                  </span>
                </div>
                <div className="mt-3 text-base font-extrabold">{g.title}</div>
                <div className="text-[11px] text-[var(--color-muted)]">{g.tagline}</div>
                <div className="mt-2 font-numeric text-xs text-[var(--color-cyan)]">
                  {g.liveCount.toLocaleString()}명 플레이 중
                </div>
              </Premium3DCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

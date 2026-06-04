import { createFileRoute, notFound } from "@tanstack/react-router";
import { GameBetShellChrome } from "@/shared/layout/GameBetShellChrome";
import { CrashVisualShell } from "@/features/games/crash/CrashVisualShell";
import { RpsVisualShell } from "@/features/games/rps/RpsVisualShell";
import { SlotsVisualShell } from "@/features/games/slots/SlotsVisualShell";
import { LuckyBoxVisualShell } from "@/features/games/lucky-box/LuckyBoxVisualShell";
import { RouletteVisualShell } from "@/features/games/roulette/RouletteVisualShell";
import { CardFlipVisualShell } from "@/features/games/card-flip/CardFlipVisualShell";
import { MOCK_GAMES, type GameSlug } from "@/mocks/games";

import type { ComponentType } from "react";

const SHELLS: Record<GameSlug, ComponentType> = {
  crash: CrashVisualShell,
  rps: RpsVisualShell,
  slots: SlotsVisualShell,
  "lucky-box": LuckyBoxVisualShell,
  roulette: RouletteVisualShell,
  "card-flip": CardFlipVisualShell,
};

export const Route = createFileRoute("/earn/games/$slug")({
  ssr: false,
  head: ({ params }) => ({ meta: [{ title: `${params.slug} · PHONARA` }] }),
  component: GameRoute,
  notFoundComponent: () => <div className="p-6 text-center text-sm text-[var(--color-muted)]">게임을 찾을 수 없어요</div>,
});

function GameRoute() {
  const { slug } = Route.useParams();
  const meta = MOCK_GAMES.find((g) => g.slug === slug);
  if (!meta) throw notFound();
  const Shell = SHELLS[slug as GameSlug];
  return (
    <GameBetShellChrome title={meta.title}>
      <Shell />
    </GameBetShellChrome>
  );
}

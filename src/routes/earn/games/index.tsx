import { createFileRoute } from "@tanstack/react-router";
import { GameLobby } from "@/features/games/lobby/GameLobby";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";

export const Route = createFileRoute("/earn/games/")({
  ssr: false,
  head: () => ({ meta: [{ title: "게임 로비 · PHONARA" }] }),
  component: LobbyRoute,
});

function LobbyRoute() {
  return (
    <MobileShell>
      <main className="flex-1 px-4 pb-6 pt-3">
        <GameLobby />
      </main>
      <BottomNav />
    </MobileShell>
  );
}

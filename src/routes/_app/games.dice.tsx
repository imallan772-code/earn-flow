import { createFileRoute } from "@tanstack/react-router";
import { DiceScreen } from "@/features/games/dice/DiceScreen";

export const Route = createFileRoute("/_app/games/dice")({
  head: () => ({
    meta: [
      { title: "Dice · PHONARA" },
      { name: "description", content: "결정론적 Provably Fair Dice 게임. 99% RTP." },
    ],
  }),
  component: DiceScreen,
});

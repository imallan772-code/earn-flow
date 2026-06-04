import { createFileRoute } from "@tanstack/react-router";
import { PlinkoScreen } from "@/features/games/plinko/PlinkoScreen";

export const Route = createFileRoute("/_app/games/plinko")({
  head: () => ({
    meta: [
      { title: "Plinko · PHONARA" },
      { name: "description", content: "Provably Fair Plinko. 8/12/16줄 × 3리스크." },
    ],
  }),
  component: PlinkoScreen,
});

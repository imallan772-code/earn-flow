import { createFileRoute } from "@tanstack/react-router";
import { MinesScreen } from "@/features/games/mines/MinesScreen";

export const Route = createFileRoute("/_app/games/mines")({
  head: () => ({
    meta: [
      { title: "Mines · PHONARA" },
      { name: "description", content: "Provably Fair Mines. 5×5, 지뢰 1~24개 선택. RTP 99%." },
    ],
  }),
  component: MinesScreen,
});

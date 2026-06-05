import { createFileRoute } from "@tanstack/react-router";
import { LimboScreen } from "@/features/games/limbo/LimboScreen";

export const Route = createFileRoute("/_app/games/limbo")({
  head: () => ({
    meta: [
      { title: "Limbo · PHONARA" },
      {
        name: "description",
        content: "Provably Fair Limbo. 목표 배수 설정 후 즉시 결정. RTP 99%.",
      },
    ],
  }),
  component: LimboScreen,
});

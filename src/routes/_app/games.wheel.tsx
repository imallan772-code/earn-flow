import { createFileRoute } from "@tanstack/react-router";
import { WheelScreen } from "@/features/games/wheel/WheelScreen";

export const Route = createFileRoute("/_app/games/wheel")({
  head: () => ({
    meta: [
      { title: "Wheel · PHONARA" },
      {
        name: "description",
        content: "Provably Fair Wheel. 위험도 × 세그먼트 가중 추첨. RTP 99%.",
      },
    ],
  }),
  component: WheelScreen,
});

import { createFileRoute } from "@tanstack/react-router";
import { CrashScreen } from "@/features/games/crash/CrashScreen";

export const Route = createFileRoute("/_app/games/crash")({
  head: () => ({
    meta: [
      { title: "Crash · PHONARA" },
      { name: "description", content: "결정론적 Provably Fair Crash 게임. 97% RTP." },
    ],
  }),
  component: CrashScreen,
});

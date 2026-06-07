import { createFileRoute } from "@tanstack/react-router";
import { AutoBetScreen } from "@/features/auto-bet/AutoBetScreen";

export const Route = createFileRoute("/_app/auto-bet")({
  component: AutoBetScreen,
});

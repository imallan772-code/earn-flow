import { createFileRoute } from "@tanstack/react-router";
import { EarnScreen } from "@/features/earn/EarnScreen";

export const Route = createFileRoute("/_app/earn")({
  head: () => ({ meta: [{ title: "Earn · PHONARA" }] }),
  component: EarnScreen,
});

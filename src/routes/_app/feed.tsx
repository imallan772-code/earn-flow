import { createFileRoute } from "@tanstack/react-router";
import { FeedScreen } from "@/features/feed/FeedScreen";

export const Route = createFileRoute("/_app/feed")({
  head: () => ({ meta: [{ title: "Pulse · PHONARA" }] }),
  component: FeedScreen,
});

import { createFileRoute } from "@tanstack/react-router";
import { EventScreen } from "@/features/event/EventScreen";

export const Route = createFileRoute("/_app/event")({
  head: () => ({ meta: [{ title: "이벤트 · PHONARA" }] }),
  component: EventScreen,
});

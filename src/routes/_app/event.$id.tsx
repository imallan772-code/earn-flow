import { createFileRoute } from "@tanstack/react-router";
import { EventDetail } from "@/features/event/EventDetail";

export const Route = createFileRoute("/_app/event/$id")({
  head: () => ({ meta: [{ title: "이벤트 상세 · PHONARA" }] }),
  component: EventDetailRoute,
});

function EventDetailRoute() {
  const { id } = Route.useParams();
  return <EventDetail id={id} />;
}

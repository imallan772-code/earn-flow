import { createFileRoute } from "@tanstack/react-router";
import { NoticeDetail } from "@/features/notice/NoticeDetail";

export const Route = createFileRoute("/_app/notice/$id")({
  head: () => ({ meta: [{ title: "공지 상세 · PHONARA" }] }),
  component: NoticeDetailRoute,
});

function NoticeDetailRoute() {
  const { id } = Route.useParams();
  return <NoticeDetail id={id} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { NoticeScreen } from "@/features/notice/NoticeScreen";

export const Route = createFileRoute("/_app/notice")({
  head: () => ({ meta: [{ title: "공지사항 · PHONARA" }] }),
  component: NoticeScreen,
});

import { createFileRoute } from "@tanstack/react-router";
import { AdminNotice } from "@/features/admin/AdminNotice";
export const Route = createFileRoute("/admin/notice")({
  ssr: false,
  head: () => ({ meta: [{ title: "공지 관리 · PHONARA Admin" }] }),
  component: AdminNotice,
});

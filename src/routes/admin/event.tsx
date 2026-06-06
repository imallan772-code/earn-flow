import { createFileRoute } from "@tanstack/react-router";
import { AdminEvent } from "@/features/admin/AdminEvent";
export const Route = createFileRoute("/admin/event")({
  ssr: false,
  head: () => ({ meta: [{ title: "이벤트 관리 · PHONARA 운영" }] }),
  component: AdminEvent,
});

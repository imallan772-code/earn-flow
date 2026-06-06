import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({ meta: [{ title: "운영 대시보드 · PHONARA" }] }),
  component: AdminDashboard,
});

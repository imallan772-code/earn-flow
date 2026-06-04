import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
export const Route = createFileRoute("/admin/")({ ssr: false, head: () => ({ meta: [{ title: "PHONARA Admin" }] }), component: AdminDashboard });

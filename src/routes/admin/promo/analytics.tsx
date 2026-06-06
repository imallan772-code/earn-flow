import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsDashboard } from "@/features/admin/promo/components/AnalyticsDashboard";

export const Route = createFileRoute("/admin/promo/analytics")({
  ssr: false,
  component: AnalyticsDashboard,
});

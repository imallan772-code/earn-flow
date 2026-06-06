import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsKpis } from "@/features/admin/promo/components/AnalyticsKpis";

export const Route = createFileRoute("/admin/promo/analytics")({
  ssr: false,
  component: AnalyticsKpis,
});

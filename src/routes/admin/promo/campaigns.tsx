import { createFileRoute } from "@tanstack/react-router";
import { CampaignTable } from "@/features/admin/promo/components/CampaignTable";

export const Route = createFileRoute("/admin/promo/campaigns")({
  ssr: false,
  component: CampaignTable,
});

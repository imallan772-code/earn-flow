import { createFileRoute } from "@tanstack/react-router";
import { AssetGrid } from "@/features/admin/promo/components/AssetGrid";

export const Route = createFileRoute("/admin/promo/assets")({
  ssr: false,
  component: AssetGrid,
});

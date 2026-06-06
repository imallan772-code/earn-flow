import { createFileRoute } from "@tanstack/react-router";
import { StudioPanel } from "@/features/admin/promo/components/StudioPanel";

export const Route = createFileRoute("/admin/promo/studio")({
  ssr: false,
  component: StudioPanel,
});

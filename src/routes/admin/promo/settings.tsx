import { createFileRoute } from "@tanstack/react-router";
import { SettingsPanel } from "@/features/admin/promo/components/SettingsPanel";

export const Route = createFileRoute("/admin/promo/settings")({
  ssr: false,
  component: SettingsPanel,
});

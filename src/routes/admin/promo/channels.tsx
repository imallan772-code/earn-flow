import { createFileRoute } from "@tanstack/react-router";
import { ChannelMatrix } from "@/features/admin/promo/components/ChannelMatrix";

export const Route = createFileRoute("/admin/promo/channels")({
  ssr: false,
  component: ChannelMatrix,
});

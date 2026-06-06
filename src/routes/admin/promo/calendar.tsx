import { createFileRoute } from "@tanstack/react-router";
import { CalendarBoard } from "@/features/admin/promo/components/CalendarBoard";

export const Route = createFileRoute("/admin/promo/calendar")({
  ssr: false,
  component: CalendarBoard,
});

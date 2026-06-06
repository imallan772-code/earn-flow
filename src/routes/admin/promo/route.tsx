import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PromoShell } from "@/features/admin/promo/components/PromoShell";

export const Route = createFileRoute("/admin/promo")({
  ssr: false,
  head: () => ({ meta: [{ title: "PHONARA Admin · Promo" }] }),
  component: PromoLayout,
});

function PromoLayout() {
  return (
    <PromoShell>
      <Outlet />
    </PromoShell>
  );
}

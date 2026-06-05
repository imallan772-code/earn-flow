import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAdmin } from "@/features/auth/RequireAdmin";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminRouteLayout,
});

function AdminRouteLayout() {
  return (
    <RequireAdmin>
      <Outlet />
    </RequireAdmin>
  );
}

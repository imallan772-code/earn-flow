import { Outlet, createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  return (
    <MobileShell>
      <main className="flex-1 px-4 pb-6 pt-3">
        <Outlet />
      </main>
      <BottomNav />
    </MobileShell>
  );
}

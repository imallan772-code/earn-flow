import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { GameLayoutProvider } from "@/shared/layout/GameLayoutProvider";
import { ResponsiveShell } from "@/shared/layout/ResponsiveShell";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  return (
    <RequireAuth>
      <GameLayoutProvider>
        <ResponsiveShell>
          <Outlet />
        </ResponsiveShell>
      </GameLayoutProvider>
    </RequireAuth>
  );
}

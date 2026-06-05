/**
 * Admin standalone SPA — deploy to admin.phonara.com
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AuthProvider } from "@/features/auth/AuthContext";
import { RequireAdmin } from "@/features/auth/RequireAdmin";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { AdminNotice } from "@/features/admin/AdminNotice";
import { AdminEvent } from "@/features/admin/AdminEvent";
import "@/styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const rootRoute = createRootRoute({
  component: () => (
    <RequireAdmin>
      <Outlet />
    </RequireAdmin>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: AdminDashboard,
});

const noticeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/notice",
  component: AdminNotice,
});

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/event",
  component: AdminEvent,
});

const adminRouter = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, noticeRoute, eventRoute]),
  defaultPreload: "intent",
});

export function AdminStandaloneApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={adminRouter} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

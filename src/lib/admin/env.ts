/**
 * Admin surface flags — web /admin routes vs standalone apps/admin deploy.
 *
 * - VITE_ADMIN_ENABLED: expose /admin on the public web app (default false in prod).
 * - VITE_ADMIN_DEV_OPEN: local-only bypass when Supabase admin_users is empty.
 */
export function isAdminSurfaceEnabled(): boolean {
  if (import.meta.env.VITE_ADMIN_ENABLED === "true") return true;
  return Boolean(import.meta.env.DEV) && import.meta.env.VITE_ADMIN_DEV_OPEN === "true";
}

export function isAdminDevOpen(): boolean {
  return Boolean(import.meta.env.DEV) && import.meta.env.VITE_ADMIN_DEV_OPEN === "true";
}

-- Explicit deny for direct client access to admin_users (admin RPCs only).
CREATE POLICY admin_users_no_client_access ON public.admin_users
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { hasAuthCallbackInUrl } from "@/lib/auth/recovery";
import { useAuth } from "./AuthContext";

/** Old reset emails → /login; forward recovery sessions to /reset-password. */
export function AuthRecoveryRedirect() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { passwordRecovery } = useAuth();

  // Legacy links land on /login?code=… — move tokens to /reset-password before GuestOnly runs.
  useEffect(() => {
    if (pathname !== "/login" || !hasAuthCallbackInUrl()) return;
    const { search, hash } = window.location;
    window.location.replace(`/reset-password${search}${hash}`);
  }, [pathname]);

  useEffect(() => {
    if (passwordRecovery && pathname !== "/reset-password") {
      navigate({ to: "/reset-password", replace: true });
    }
  }, [passwordRecovery, pathname, navigate]);

  useEffect(() => {
    if (pathname === "/reset-password") return;

    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate({ to: "/reset-password", replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, pathname]);

  return null;
}

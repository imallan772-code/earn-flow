import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { friendlyAuthError } from "@/lib/auth/errors";
import { clearAuthParamsFromUrl, readOAuthErrorFromUrl } from "@/lib/auth/oauthCallback";
import { appToast } from "@/shared/ui/toast";

/** OAuth failures may land on site_url (/) with ?error= — forward to login with toast. */
export function AuthOAuthErrorHandler() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (pathname === "/auth/callback") return;

    const message = readOAuthErrorFromUrl();
    if (!message) return;

    appToast.raw.error(friendlyAuthError(message));
    clearAuthParamsFromUrl();
    navigate({ to: "/login", replace: true });
  }, [pathname, navigate]);

  return null;
}

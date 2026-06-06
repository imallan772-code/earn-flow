import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/errors";
import { clearAuthParamsFromUrl, readOAuthErrorFromUrl } from "@/lib/auth/oauthCallback";
import { appToast } from "@/shared/ui/toast";

function AuthSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cosmic">
      <div className="glass-3 rounded-3xl px-8 py-6 text-center">
        <div className="text-sm font-semibold">Google 로그인 연결 중…</div>
        <div className="mt-1 text-xs text-(--color-muted)">PHONARA</div>
      </div>
    </div>
  );
}

async function fetchProfile(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** OAuth return URL — no RequireAuth; completes PKCE before routing to app. */
export function AuthCallbackScreen() {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const supabase = getSupabaseClient();

    async function go(session: Session) {
      if (handledRef.current) return;
      handledRef.current = true;

      try {
        const prof = await fetchProfile(session.user.id);
        clearAuthParamsFromUrl();
        appToast.auth.welcomeBack();
        navigate({
          to: prof?.onboarding_completed ? "/feed" : "/onboarding",
          replace: true,
        });
      } catch {
        appToast.raw.error("프로필을 불러오지 못했습니다. 다시 로그인해 주세요.");
        clearAuthParamsFromUrl();
        navigate({ to: "/login", replace: true });
      }
    }

    async function fail(message: string) {
      if (handledRef.current) return;
      handledRef.current = true;
      appToast.raw.error(friendlyAuthError(message));
      clearAuthParamsFromUrl();
      navigate({ to: "/login", replace: true });
    }

    async function resolve() {
      const urlError = readOAuthErrorFromUrl();
      if (urlError) {
        await fail(urlError);
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const msg = error.message.toLowerCase();
          const alreadyDone =
            msg.includes("already") ||
            msg.includes("used") ||
            msg.includes("verifier not found");
          if (!alreadyDone) {
            await fail(error.message);
            return;
          }
        } else if (data.session?.user) {
          await go(data.session);
          return;
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        await go(sessionData.session);
        return;
      }

      await fail("로그인 연결에 실패했습니다. 다시 시도해 주세요.");
    }

    void resolve();
  }, [navigate]);

  return <AuthSpinner />;
}

import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";

function AuthSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cosmic">
      <div className="glass-3 rounded-3xl px-8 py-6 text-center">
        <div className="text-sm font-semibold">세션 확인 중...</div>
        <div className="mt-1 text-xs text-(--color-muted)">PHONARA 연결</div>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, profile, isConfigured } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConfigured || status === "loading") return;
    if (status === "unauthenticated") {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (profile && !profile.onboarding_completed) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isConfigured, status, profile, navigate]);

  if (!isConfigured) return <>{children}</>;
  if (status === "loading") return <AuthSpinner />;
  if (status === "unauthenticated") return null;
  if (profile && !profile.onboarding_completed) return null;
  return <>{children}</>;
}

export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { status, profile, isConfigured } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConfigured || status === "loading") return;
    if (status === "unauthenticated") {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (profile?.onboarding_completed) {
      navigate({ to: "/feed", replace: true });
    }
  }, [isConfigured, status, profile, navigate]);

  if (!isConfigured) return <>{children}</>;
  if (status === "loading") return <AuthSpinner />;
  if (status === "unauthenticated") return null;
  if (profile?.onboarding_completed) return null;
  return <>{children}</>;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, profile, isConfigured, passwordRecovery } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConfigured || status !== "authenticated") return;
    if (passwordRecovery) {
      navigate({ to: "/reset-password", replace: true });
      return;
    }
    navigate({
      to: profile?.onboarding_completed ? "/feed" : "/onboarding",
      replace: true,
    });
  }, [isConfigured, status, profile, passwordRecovery, navigate]);

  if (isConfigured && status === "loading") return <AuthSpinner />;
  if (isConfigured && status === "authenticated") return null;
  return <>{children}</>;
}

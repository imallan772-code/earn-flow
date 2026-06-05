/**
 * RequireAdmin — authenticated + admin_users membership (or controlled dev bypass).
 *
 * Production web: set VITE_ADMIN_ENABLED=true only when intentionally exposing /admin.
 * Standalone apps/admin: always enabled at build time.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { fetchIsAdmin } from "@/lib/api/admin/auth";
import { isAdminDevOpen, isAdminSurfaceEnabled } from "@/lib/admin/env";

function AdminGateSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cosmic">
      <div className="glass-3 rounded-3xl px-8 py-6 text-center">
        <div className="text-sm font-semibold">운영 권한 확인 중...</div>
        <div className="mt-1 text-xs text-(--color-muted)">PHONARA Admin</div>
      </div>
    </div>
  );
}

function AdminDenied() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cosmic px-4">
      <div className="glass-3 max-w-sm rounded-3xl p-8 text-center shadow-depth-3">
        <h1 className="text-lg font-semibold">운영 콘솔 접근 불가</h1>
        <p className="mt-1.5 text-sm text-(--color-muted)">
          admin_users에 등록된 계정으로 로그인해야 합니다.
        </p>
        <Link
          to="/login"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-2xl bg-holographic px-5 text-sm font-semibold text-(--color-bg-0)"
        >
          로그인
        </Link>
      </div>
    </div>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [adminOk, setAdminOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAdminSurfaceEnabled()) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (!isConfigured) {
      setAdminOk(isAdminDevOpen());
      return;
    }
    if (status === "unauthenticated") {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (status !== "authenticated") return;

    let alive = true;
    fetchIsAdmin()
      .then((ok) => {
        if (!alive) return;
        if (!ok && isAdminDevOpen()) {
          setAdminOk(true);
          return;
        }
        setAdminOk(ok);
      })
      .catch(() => {
        if (!alive) return;
        setAdminOk(isAdminDevOpen());
      });
    return () => {
      alive = false;
    };
  }, [isConfigured, status, navigate]);

  if (!isAdminSurfaceEnabled()) return null;
  if (!isConfigured && isAdminDevOpen()) return <>{children}</>;
  if (status === "loading" || adminOk === null) return <AdminGateSpinner />;
  if (status === "unauthenticated") return null;
  if (!adminOk) return <AdminDenied />;
  return <>{children}</>;
}

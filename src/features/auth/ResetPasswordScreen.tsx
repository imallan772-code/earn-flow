import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound } from "lucide-react";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/errors";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthPageShell } from "@/shared/layout/AuthPageShell";
import { appToast } from "@/shared/ui/toast";

type Phase = "loading" | "form" | "invalid";

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const { profile, refreshProfile, clearPasswordRecovery } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setPhase("form");
      }
    });

    async function resolveSession() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !cancelled) {
          setPhase("invalid");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setPhase("form");
        return;
      }
      // PKCE / hash exchange may finish shortly after mount
      await new Promise((r) => setTimeout(r, 600));
      if (cancelled) return;
      const retry = await supabase.auth.getSession();
      if (retry.data.session) {
        setPhase("form");
      } else {
        setPhase("invalid");
      }
    }

    void resolveSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (password.length < 6) {
      appToast.raw.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      appToast.raw.error("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearPasswordRecovery();
      const nextProfile = (await refreshProfile()) ?? profile;
      appToast.auth.passwordChanged();
      navigate({
        to: nextProfile?.onboarding_completed ? "/feed" : "/onboarding",
        replace: true,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다";
      appToast.raw.error(friendlyAuthError(raw));
    } finally {
      setSubmitting(false);
    }
  }, [password, confirm, navigate, profile, refreshProfile, clearPasswordRecovery]);

  return (
    <AuthPageShell>
      <div className="flex items-center justify-between">
        <Link
          to="/login"
          className="glass-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl"
        >
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-cyan">보안</div>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          새 비밀번호
          <br />
          <span className="text-holographic">설정하기</span>
        </h1>
      </div>

      {phase === "loading" && (
        <div className="glass-2 mt-8 rounded-2xl p-6 text-center text-sm text-muted">
          재설정 링크 확인 중…
        </div>
      )}

      {phase === "invalid" && (
        <div className="glass-2 mt-8 space-y-4 rounded-2xl p-6 text-center text-sm">
          <KeyRound size={28} className="mx-auto text-cyan" />
          <p className="text-muted">
            링크가 만료되었거나 유효하지 않습니다. 로그인 화면에서 비밀번호 재설정을 다시
            요청해 주세요.
          </p>
          <Link
            to="/login"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-holographic px-5 text-sm font-bold text-bg-0"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      )}

      {phase === "form" && (
        <div className="mt-8 space-y-4">
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold text-muted">새 비밀번호</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="6자 이상"
              className="phon-reset-input"
            />
          </label>
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold text-muted">비밀번호 확인</div>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="한 번 더 입력"
              className="phon-reset-input"
            />
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="mt-2 flex h-14 w-full items-center justify-center rounded-2xl bg-holographic text-base font-extrabold text-bg-0 shadow-glow-purple disabled:opacity-60"
          >
            {submitting ? "저장 중…" : "비밀번호 변경"}
          </button>
        </div>
      )}

      <style>{`
        .phon-reset-input {
          width: 100%;
          height: 52px;
          padding: 0 16px;
          border-radius: 14px;
          background: color-mix(in oklab, var(--color-surface) 70%, transparent);
          border: 1px solid var(--color-border-hi);
          color: var(--color-foreground);
          font-size: 16px;
          outline: none;
        }
        .phon-reset-input:focus {
          border-color: color-mix(in oklab, var(--color-cyan) 60%, transparent);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-cyan) 16%, transparent);
        }
      `}</style>
    </AuthPageShell>
  );
}

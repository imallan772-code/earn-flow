import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { m } from "framer-motion";
import { appToast } from "@/shared/ui/toast";
import { Sparkles, Copy, Flame } from "lucide-react";
import { AuthPageShell } from "@/shared/layout/AuthPageShell";
import { FloatingReward } from "@/shared/motion/FloatingReward";
import { RewardBurst } from "@/shared/motion/RewardBurst";
import { CountUp } from "@/shared/motion/CountUp";
import { cn } from "@/lib/utils";
import { RequireOnboarding } from "@/features/auth/RequireAuth";
import { useAuth } from "@/features/auth/AuthContext";
import { useProfile } from "@/features/profile/useProfile";

const STEPS = [
  { reward: 5000, title: "탭하여 5,000 PHON 받기", caption: "지금 8,420명이 받는 중" },
  { reward: 2500, title: "닉네임 입력 +2,500 PHON", caption: "기억하기 쉬운 이름이 좋아요" },
  {
    reward: 1500,
    title: "추천코드 복사 +1,500 PHON",
    caption: "친구에게 공유하면 추가 5,000 PHON",
  },
  { reward: 1000, title: "오늘 출석 불꽃 +1,000 PHON", caption: "내일도 들어오면 스트릭 시작!" },
];

export function Onboarding() {
  return (
    <RequireOnboarding>
      <OnboardingFlow />
    </RequireOnboarding>
  );
}

function OnboardingFlow() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { completeOnboardingStep, balance } = useProfile();
  const [step, setStep] = useState(profile?.onboarding_step ?? 0);
  const [balanceView, setBalanceView] = useState(balance?.phon ?? 0);
  const [floatAmt, setFloatAmt] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.onboarding_step != null) setStep(profile.onboarding_step);
  }, [profile?.onboarding_step]);

  useEffect(() => {
    if (balance?.phon != null) setBalanceView(balance.phon);
  }, [balance?.phon]);

  const cfg = STEPS[step] ?? STEPS[0];
  const referralCode = balance?.referralCode ?? profile?.referral_code ?? "PHO-------";

  async function advance() {
    if (submitting || step >= STEPS.length) return;
    setSubmitting(true);
    try {
      const result = await completeOnboardingStep(step, step === 1 ? nickname : undefined);
      setBalanceView(result.balance.phon);
      setFloatAmt(result.reward);
      setBurst((n) => n + 1);
      setTimeout(() => setFloatAmt(null), 900);
      await refreshProfile();

      const next = step + 1;
      if (next >= STEPS.length) {
        setTimeout(() => navigate({ to: "/feed" }), 700);
      } else {
        setTimeout(() => setStep(next), 700);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "온보딩 처리에 실패했습니다";
      appToast.raw.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                i <= step ? "bg-holographic" : "bg-white/10",
              )}
            />
          ))}
        </div>
        <div className="glass-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
          <Sparkles size={14} style={{ color: "var(--color-gold)" }} />
          <CountUp value={balanceView} className="font-numeric text-sm font-bold text-gold" />
          <span className="text-[10px] text-(--color-muted)">PHON</span>
        </div>
      </div>

      <div className="mt-12 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-(--color-cyan)">
          STEP {step + 1} / {STEPS.length}
        </div>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{cfg.title}</h1>
        <p className="mt-2 text-xs text-(--color-muted)">{cfg.caption}</p>

        <div className="relative mt-10 flex items-center justify-center">
          {step === 0 && (
            <m.button
              onClick={advance}
              disabled={submitting}
              whileTap={{ scale: 0.95 }}
              className="relative flex h-48 w-48 items-center justify-center rounded-full bg-holographic shadow-glow-purple disabled:opacity-60"
            >
              <RewardBurst trigger={burst} />
              <Sparkles size={64} className="text-(--color-bg-0)" strokeWidth={2} />
            </m.button>
          )}
          {step === 1 && (
            <div className="w-full space-y-3">
              <input
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 12))}
                placeholder="닉네임 (2~12자)"
                className="phon-input"
              />
              <button
                onClick={advance}
                disabled={nickname.length < 2 || submitting}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-holographic text-base font-bold text-(--color-bg-0) shadow-glow-purple disabled:opacity-50"
              >
                저장하고 +2,500 PHON
              </button>
            </div>
          )}
          {step === 2 && (
            <div className="glass-3 w-full rounded-3xl p-6 text-center">
              <div className="text-xs text-(--color-muted)">내 추천코드</div>
              <div className="mt-2 font-numeric text-3xl font-extrabold text-holographic">
                {referralCode}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(referralCode).catch(() => {});
                  appToast.referral.copied();
                  void advance();
                }}
                disabled={submitting}
                className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-holographic px-6 font-bold text-(--color-bg-0) shadow-glow-pink disabled:opacity-60"
              >
                <Copy size={16} /> 복사하고 +1,500 PHON
              </button>
            </div>
          )}
          {step === 3 && (
            <m.button
              onClick={advance}
              disabled={submitting}
              whileTap={{ scale: 0.95 }}
              className="relative flex h-48 w-48 items-center justify-center rounded-full disabled:opacity-60"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--color-pink) 40%, transparent), transparent 70%)",
              }}
            >
              <RewardBurst trigger={burst} />
              <Flame size={84} style={{ color: "var(--color-gold)" }} strokeWidth={2.2} />
            </m.button>
          )}
        </div>
      </div>

      <div className="mt-6 text-center text-[11px] text-muted-2">
        뒤로가기 불가 · 4단계만 완료하면 끝
      </div>

      <FloatingReward amount={floatAmt} />

      <style>{`
        .phon-input {
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
        .phon-input:focus {
          border-color: color-mix(in oklab, var(--color-cyan) 60%, transparent);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-cyan) 16%, transparent);
        }
      `}</style>
    </AuthPageShell>
  );
}

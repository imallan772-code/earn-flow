import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Smartphone, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { AuthPageShell } from "@/shared/layout/AuthPageShell";
import { appToast } from "@/shared/ui/toast";
import { OnlineCounterChip } from "@/shared/layout/OnlineCounterChip";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";
type Tab = "phone" | "email" | "passkey" | "google";

interface Props {
  mode: Mode;
}

const TABS: { id: Tab; label: string; Icon: typeof Smartphone }[] = [
  { id: "phone", label: "휴대폰", Icon: Smartphone },
  { id: "email", label: "이메일", Icon: Mail },
  { id: "passkey", label: "패스키", Icon: KeyRound },
  { id: "google", label: "구글", Icon: KeyRound },
];

export function AuthShell({ mode }: Props) {
  const [tab, setTab] = useState<Tab>("phone");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const isSignup = mode === "signup";

  function mockSignIn() {
    if (isSignup) appToast.auth.signupDone();
    else appToast.auth.welcomeBack();
    // MERGE: replace with useAuth().signInWithX from phonara-world-main
    navigate({ to: isSignup ? "/onboarding" : "/feed" });
  }

  function updatePin(i: number, v: string) {
    const cleaned = v.replace(/\D/g, "").slice(0, 1);
    const next = [...pin];
    next[i] = cleaned;
    setPin(next);
    if (cleaned && i < 5) {
      const el = document.getElementById(`pin-${i + 1}`);
      el?.focus();
    }
  }

  return (
    <AuthPageShell>
      <div className="flex items-center justify-between">
        <Link to="/" className="glass-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl">
          <ArrowLeft size={18} />
        </Link>
        <OnlineCounterChip compact />
      </div>

      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-cyan)]">
          {isSignup ? "🚀 1,800 PHON 첫 보상 대기 중" : "👋 다시 오신 걸 환영해요"}
        </div>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          {isSignup ? <>3초 만에<br /><span className="text-holographic">PHONARA 시작</span></> : <>로그인해서<br /><span className="text-holographic">보상 이어가기</span></>}
        </h1>
        <div className="mt-2 text-xs text-[var(--color-muted)]">지금 가입 중인 사용자 <span className="font-semibold text-[var(--color-foreground)]">12,482명</span> · 마감 임박 이벤트</div>
      </div>

      {/* Tabs */}
      <div className="glass-2 mt-6 grid grid-cols-4 gap-1 rounded-2xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex h-11 items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors",
              tab === t.id ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)]"
            )}
          >
            {tab === t.id && (
              <motion.span
                layoutId="auth-tab"
                className="absolute inset-0 rounded-xl ring-aurora-live"
                style={{ background: "color-mix(in oklab, var(--color-cyan) 14%, transparent)" }}
              />
            )}
            <t.Icon size={14} className="relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex-1">
        {tab === "phone" && (
          <div className="space-y-4">
            <Field label="휴대폰 번호">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric"
                placeholder="010-0000-0000"
                className="phon-input"
              />
            </Field>
            <Field label="PIN 6자리">
              <div className="flex justify-between gap-1.5">
                {pin.map((d, i) => (
                  <input
                    key={i}
                    id={`pin-${i}`}
                    value={d}
                    onChange={(e) => updatePin(i, e.target.value)}
                    inputMode="numeric"
                    maxLength={1}
                    className={cn(
                      "glass-2 h-14 w-full max-w-[48px] rounded-xl text-center font-numeric text-xl font-bold outline-none transition-all",
                      d ? "ring-aurora-live text-[var(--color-cyan)]" : ""
                    )}
                  />
                ))}
              </div>
            </Field>
          </div>
        )}
        {tab === "email" && (
          <div className="space-y-4">
            <Field label="이메일">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@phonara.app" className="phon-input" />
            </Field>
            <Field label="비밀번호">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" className="phon-input" />
            </Field>
          </div>
        )}
        {tab === "passkey" && (
          <div className="glass-2 rounded-2xl p-5 text-center text-sm text-[var(--color-muted)]">
            <KeyRound size={28} className="mx-auto mb-2" style={{ color: "var(--color-cyan)" }} />
            <div className="font-semibold text-[var(--color-foreground)]">패스키로 1초 로그인</div>
            <div className="mt-1 text-xs">Face ID · Touch ID · 윈도우 Hello</div>
          </div>
        )}
        {tab === "google" && (
          <div className="glass-2 rounded-2xl p-5 text-center text-sm text-[var(--color-muted)]">
            <div className="font-semibold text-[var(--color-foreground)]">구글 계정으로 계속하기</div>
            <div className="mt-1 text-xs">탭하면 mock 인증 후 다음 화면으로 이동합니다</div>
          </div>
        )}
      </div>

      <button
        onClick={mockSignIn}
        className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-holographic text-base font-extrabold text-[var(--color-bg-0)] shadow-glow-purple"
      >
        {isSignup ? "지금 시작하고 1,800 PHON 받기" : "로그인"}
      </button>

      <Link to={isSignup ? "/login" : "/signup"} className="mt-4 text-center text-xs text-[var(--color-muted)]">
        {isSignup ? "이미 계정이 있나요? 로그인" : "처음이신가요? 가입하고 1,800 PHON"}
      </Link>

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
          transition: border-color .2s, box-shadow .2s;
        }
        .phon-input:focus {
          border-color: color-mix(in oklab, var(--color-cyan) 60%, transparent);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-cyan) 16%, transparent);
        }
      `}</style>
    </AuthPageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-[var(--color-muted)]">{label}</div>
      {children}
    </label>
  );
}

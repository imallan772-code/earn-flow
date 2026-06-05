import { Link, useNavigate } from "@tanstack/react-router";
import {
  Copy,
  LogOut,
  Settings,
  Crown,
  Wallet,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
} from "lucide-react";
import { appToast } from "@/shared/ui/toast";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { CountUp } from "@/shared/motion/CountUp";
import { formatPHON, formatUSDT, formatKRW } from "@/lib/format";
import { useProfile } from "@/features/profile/useProfile";
import { resolveBalanceView } from "@/features/profile/balanceView";
import { useAuth } from "@/features/auth/AuthContext";

export function ProfileScreen() {
  const navigate = useNavigate();
  const { balance, isLoading } = useProfile();
  const { signOut, user, isConfigured } = useAuth();
  const { view } = resolveBalanceView(balance, { isLoading, isConfigured });

  async function handleSignOut() {
    try {
      await signOut();
      appToast.raw.success("로그아웃되었습니다");
      navigate({ to: "/login", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그아웃에 실패했습니다";
      appToast.raw.error(message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="👤 MY"
        title={view.nickname}
        description={user?.email ?? "포나라 우주의 일원"}
      />

      <Premium3DCard className="p-4" glow="gold">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-holographic shadow-glow-purple">
            <Crown size={22} className="text-(--color-bg-0)" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{view.vipTier} · VIP 승급 폭주</div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full bg-holographic"
                style={{ width: `${view.vipProgress * 100}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-(--color-muted)">
              다음 등급까지 38% — TOP 0.01% 도전
            </div>
          </div>
        </div>
      </Premium3DCard>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "PHON", value: formatPHON(view.phon), color: "var(--color-gold)" },
          { label: "USDT", value: formatUSDT(view.usdt), color: "var(--color-cyan)" },
          { label: "KRW", value: formatKRW(view.krw), color: "var(--color-pink)" },
        ].map((b) => (
          <Premium3DCard key={b.label} className="p-3 text-center">
            <div className="text-[10px] text-(--color-muted)">{b.label}</div>
            <div className="mt-1 font-numeric text-base font-extrabold" style={{ color: b.color }}>
              {b.value}
            </div>
          </Premium3DCard>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link to="/deposit" className="glass-2 flex flex-col items-center gap-1 rounded-2xl p-3">
          <ArrowDownToLine size={20} style={{ color: "var(--color-emerald)" }} />
          <span className="text-[11px] font-semibold">입금</span>
        </Link>
        <Link to="/withdrawal" className="glass-2 flex flex-col items-center gap-1 rounded-2xl p-3">
          <ArrowUpFromLine size={20} style={{ color: "var(--color-pink)" }} />
          <span className="text-[11px] font-semibold">출금</span>
        </Link>
        <Link to="/transfer" className="glass-2 flex flex-col items-center gap-1 rounded-2xl p-3">
          <ArrowLeftRight size={20} style={{ color: "var(--color-cyan)" }} />
          <span className="text-[11px] font-semibold">전송</span>
        </Link>
      </div>

      <Premium3DCard className="p-4">
        <div className="text-xs text-(--color-muted)">내 추천코드</div>
        <div className="mt-1 flex items-center justify-between">
          <div className="font-numeric text-2xl font-extrabold text-holographic">
            {view.referralCode}
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(view.referralCode).catch(() => {});
              appToast.referral.copied();
            }}
            className="glass-1 inline-flex h-9 w-9 items-center justify-center rounded-xl"
          >
            <Copy size={14} />
          </button>
        </div>
        <div className="mt-2 text-[11px] text-gold">친구 1명당 즉시 +5,000 PHON</div>
      </Premium3DCard>

      <div className="space-y-2">
        {[
          {
            Icon: Wallet,
            label: "지갑 관리",
            note: <CountUp value={view.phon} className="font-numeric" />,
            action: undefined as (() => void) | undefined,
          },
          {
            Icon: Settings,
            label: "설정",
            note: "한국어",
            action: undefined,
          },
          {
            Icon: LogOut,
            label: "로그아웃",
            note: user?.email?.split("@")[0] ?? "계정",
            action: handleSignOut,
          },
        ].map((row) => (
          <button
            key={row.label}
            onClick={row.action}
            className="glass-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
          >
            <row.Icon size={18} style={{ color: "var(--color-muted)" }} />
            <span className="flex-1 text-sm font-semibold">{row.label}</span>
            <span className="text-xs text-(--color-muted)">{row.note}</span>
            <ChevronRight size={14} style={{ color: "var(--color-muted)" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

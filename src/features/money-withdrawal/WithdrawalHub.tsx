import { Link } from "@tanstack/react-router";
import { ArrowLeft, Wallet, Coins, Bitcoin, ShieldAlert } from "lucide-react";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";
import { MoneyChannelCard } from "@/shared/ui/MoneyChannelCard";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";

export function WithdrawalHub() {
  return (
    <MobileShell>
      <main className="flex-1 px-4 pb-6 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <Link
            to="/my"
            className="glass-1 inline-flex h-9 w-9 items-center justify-center rounded-xl"
          >
            <ArrowLeft size={16} />
          </Link>
          <PremiumPageHeader eyebrow="💸 출금" title="출금 방식" />
        </div>
        <div className="glass-1 mb-4 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs">
          <span className="text-gold font-semibold">
            🏆 VIP Gold I — 출금 수수료 50% 할인
          </span>
        </div>
        <div className="space-y-2.5">
          <MoneyChannelCard
            to="/withdrawal/phon"
            Icon={Coins}
            title="PHON 출금"
            subtitle="KRW 환전 후 송금"
            meta="1일 한도 5,000만"
            accent="gold"
          />
          <MoneyChannelCard
            to="/withdrawal/crypto"
            Icon={Bitcoin}
            title="USDT 출금"
            subtitle="TRC20 · ERC20"
            meta="수수료 1 USDT"
            accent="cyan"
          />
          <MoneyChannelCard
            to="/transfer"
            Icon={Wallet}
            title="내부 전송 (PHON↔USDT)"
            subtitle="실시간 전환 · 수수료 0"
            accent="purple"
          />
        </div>
        <div
          className="mt-5 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] text-(--color-muted)"
          style={{ borderColor: "var(--color-border)" }}
        >
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          출금은 KYC 인증 완료 회원에게만 제공됩니다. 최초 출금 신청 후 보안 심사가 진행될 수
          있습니다.
        </div>
      </main>
      <BottomNav />
    </MobileShell>
  );
}

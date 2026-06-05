import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bitcoin, Banknote, Ticket, ShieldAlert } from "lucide-react";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";
import { MoneyChannelCard } from "@/shared/ui/MoneyChannelCard";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";

export function DepositHub() {
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
          <PremiumPageHeader eyebrow="💰 입금" title="입금 방식 선택" />
        </div>

        {/* FOMO 상단 배너 — 거래소 톤이지만 이벤트는 표시 */}
        <div className="glass-1 mb-4 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs">
          <span className="text-gold font-semibold">🎁 오늘 입금 시 +10% 보너스</span>
          <span className="text-(--color-muted)">— 24시간 한정</span>
        </div>

        <div className="space-y-2.5">
          <MoneyChannelCard
            to="/deposit/crypto"
            Icon={Bitcoin}
            title="USDT 입금"
            subtitle="TRC20 · ERC20 · BSC 지원"
            meta="권장"
            accent="cyan"
          />
          <MoneyChannelCard
            to="/deposit/bank"
            Icon={Banknote}
            title="원화 계좌 입금"
            subtitle="국내 은행 무통장 입금"
            meta="1~5분"
            accent="gold"
          />
          <MoneyChannelCard
            to="/deposit/gift"
            Icon={Ticket}
            title="상품권 코드"
            subtitle="컬쳐랜드 · 해피머니"
            accent="pink"
          />
        </div>

        <div
          className="mt-5 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] text-(--color-muted)"
          style={{ borderColor: "var(--color-border)" }}
        >
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          실제 반영은 입금 확인 후 영업시간 내 처리됩니다. 외부 송금 시 정확한 네트워크/메모를
          확인하세요.
        </div>
      </main>
      <BottomNav />
    </MobileShell>
  );
}

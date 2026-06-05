import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";

export function DepositBank() {
  return (
    <MobileShell>
      <main className="flex-1 px-4 pb-6 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <Link
            to="/deposit"
            className="glass-1 inline-flex h-9 w-9 items-center justify-center rounded-xl"
          >
            <ArrowLeft size={16} />
          </Link>
          <PremiumPageHeader eyebrow="원화" title="계좌 입금 안내" />
        </div>
        <Premium3DCard className="p-5">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-(--color-muted)">은행</div>
            <div className="col-span-2 font-semibold">국민은행</div>
            <div className="text-(--color-muted)">계좌</div>
            <div className="col-span-2 font-numeric font-semibold">123-4567-8901-23</div>
            <div className="text-(--color-muted)">예금주</div>
            <div className="col-span-2 font-semibold">(주)포나라월드</div>
            <div className="text-(--color-muted)">입금자명</div>
            <div className="col-span-2 font-semibold">PHO-K7Q2X9 (회원코드)</div>
          </div>
          <button className="mt-5 h-12 w-full rounded-2xl bg-holographic font-bold text-(--color-bg-0) shadow-glow-purple">
            입금 신청서 작성
          </button>
        </Premium3DCard>
        <div
          className="mt-4 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] text-(--color-muted)"
          style={{ borderColor: "var(--color-border)" }}
        >
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          입금자명에 회원코드를 정확히 기재해야 자동 반영됩니다. 영업시간 외 입금은 익일 처리됩니다.
        </div>
      </main>
      <BottomNav />
    </MobileShell>
  );
}

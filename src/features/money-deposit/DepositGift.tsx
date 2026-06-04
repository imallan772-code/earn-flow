import { Link } from "@tanstack/react-router";
import { ArrowLeft, Ticket } from "lucide-react";
import { useState } from "react";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { appToast } from "@/shared/ui/toast";

export function DepositGift() {
  const [code, setCode] = useState("");
  return (
    <MobileShell>
      <main className="flex-1 px-4 pb-6 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <Link to="/deposit" className="glass-1 inline-flex h-9 w-9 items-center justify-center rounded-xl"><ArrowLeft size={16} /></Link>
          <PremiumPageHeader eyebrow="상품권" title="코드 입력" />
        </div>
        <Premium3DCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Ticket size={18} style={{ color: "var(--color-pink)" }} />
            <div className="text-sm font-semibold">컬쳐랜드 / 해피머니</div>
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="0000-0000-0000-0000"
            className="h-12 w-full rounded-2xl border bg-transparent px-4 font-numeric outline-none"
            style={{ borderColor: "var(--color-border-hi)" }}
          />
          <button
            onClick={() => appToast.deposit.giftPending()}
            className="mt-3 h-12 w-full rounded-2xl bg-holographic font-bold text-[var(--color-bg-0)]"
          >
            등록하기
          </button>
        </Premium3DCard>
      </main>
      <BottomNav />
    </MobileShell>
  );
}

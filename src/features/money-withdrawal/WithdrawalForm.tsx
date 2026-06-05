import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { MOCK_BALANCE } from "@/mocks/balance";
import { formatPHON, formatKRW } from "@/lib/format";
import { appToast } from "@/shared/ui/toast";

interface Props {
  kind: "phon" | "crypto";
}

export function WithdrawalForm({ kind }: Props) {
  const [amount, setAmount] = useState(50_000);
  const fee = kind === "phon" ? amount * 0.01 : 1;
  return (
    <MobileShell>
      <main className="flex-1 px-4 pb-6 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <Link
            to="/withdrawal"
            className="glass-1 inline-flex h-9 w-9 items-center justify-center rounded-xl"
          >
            <ArrowLeft size={16} />
          </Link>
          <PremiumPageHeader eyebrow="출금" title={kind === "phon" ? "PHON → KRW" : "USDT 출금"} />
        </div>
        <Premium3DCard className="p-5 space-y-4">
          <div>
            <div className="mb-1.5 text-xs text-[var(--color-muted)]">출금 금액</div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, +e.target.value))}
              className="h-14 w-full rounded-2xl border bg-transparent px-4 font-numeric text-xl font-bold outline-none"
              style={{ borderColor: "var(--color-border-hi)" }}
            />
            <div className="mt-1.5 text-[11px] text-[var(--color-muted)]">
              보유 {formatPHON(MOCK_BALANCE.phon)} {kind === "phon" ? "PHON" : "USDT"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div
              className="rounded-xl border px-3 py-2"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="text-[var(--color-muted)]">수수료</div>
              <div className="font-numeric font-semibold">
                {kind === "phon" ? formatPHON(fee) + " PHON" : "1.00 USDT"}
              </div>
            </div>
            <div
              className="rounded-xl border px-3 py-2"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="text-[var(--color-muted)]">예상 수령</div>
              <div className="font-numeric font-semibold text-[var(--color-emerald)]">
                {kind === "phon" ? formatKRW(amount - fee) : `${(amount - 1).toFixed(2)} USDT`}
              </div>
            </div>
          </div>
          <button
            onClick={() => appToast.withdrawal.submitted()}
            className="h-14 w-full rounded-2xl bg-holographic font-extrabold text-[var(--color-bg-0)] shadow-glow-purple"
          >
            출금 신청
          </button>
        </Premium3DCard>
        <div
          className="mt-4 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] text-[var(--color-muted)]"
          style={{ borderColor: "var(--color-border)" }}
        >
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          KYC Level 2 이상에서 신청 가능 · 영업일 기준 1~24시간 내 처리.
        </div>
      </main>
      <BottomNav />
    </MobileShell>
  );
}

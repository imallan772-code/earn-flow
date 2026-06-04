import { Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, ShieldAlert } from "lucide-react";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { toast } from "sonner";

const ADDR = "TQ7nXf9aZk3Yp2Bm…mock";

export function DepositCrypto() {
  return (
    <MobileShell>
      <main className="flex-1 px-4 pb-6 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <Link to="/deposit" className="glass-1 inline-flex h-9 w-9 items-center justify-center rounded-xl"><ArrowLeft size={16} /></Link>
          <PremiumPageHeader eyebrow="USDT" title="암호화폐 입금" />
        </div>

        <Premium3DCard className="flex flex-col items-center p-5">
          <div className="text-xs text-[var(--color-muted)]">네트워크</div>
          <div className="mt-1 inline-flex gap-1.5">
            {["TRC20", "ERC20", "BSC"].map((n, i) => (
              <span key={n} className={i === 0 ? "rounded-xl px-3 py-1 text-xs font-bold" : "glass-1 rounded-xl px-3 py-1 text-xs"}
                style={i === 0 ? { background: "color-mix(in oklab, var(--color-cyan) 20%, transparent)", color: "var(--color-cyan)" } : undefined}>
                {n}
              </span>
            ))}
          </div>
          <div className="my-5 flex h-44 w-44 items-center justify-center rounded-2xl bg-white">
            <div className="grid h-36 w-36 grid-cols-8 grid-rows-8 gap-px">
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} style={{ background: Math.random() > 0.5 ? "#000" : "#fff" }} />
              ))}
            </div>
          </div>
          <div className="text-[10px] font-semibold text-[var(--color-muted)]">입금 주소 (mock)</div>
          <div className="mt-1 flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2.5"
            style={{ borderColor: "var(--color-border-hi)", background: "color-mix(in oklab, var(--color-surface) 60%, transparent)" }}>
            <span className="truncate font-numeric text-xs">{ADDR}</span>
            <button onClick={() => { navigator.clipboard?.writeText(ADDR); toast.success("주소 복사됨"); }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/8">
              <Copy size={14} />
            </button>
          </div>
        </Premium3DCard>

        <div className="mt-4 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] text-[var(--color-muted)]"
          style={{ borderColor: "var(--color-border)" }}>
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          잘못된 네트워크로 송금 시 자산 복구가 불가합니다. 입금은 컨펌 완료 후 잔액에 반영됩니다.
        </div>
      </main>
      <BottomNav />
    </MobileShell>
  );
}

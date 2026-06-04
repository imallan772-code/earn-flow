import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowDown } from "lucide-react";
import { useState } from "react";
import { MobileShell } from "@/shared/layout/MobileShell";
import { BottomNav } from "@/shared/layout/BottomNav";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { toast } from "sonner";

const RATE = 1340; // 1 USDT = 1340 PHON (mock)

export function TransferBridge() {
  const [from, setFrom] = useState<"PHON" | "USDT">("PHON");
  const to = from === "PHON" ? "USDT" : "PHON";
  const [amount, setAmount] = useState(10_000);
  const converted = from === "PHON" ? amount / RATE : amount * RATE;

  return (
    <MobileShell>
      <main className="flex-1 px-4 pb-6 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <Link to="/my" className="glass-1 inline-flex h-9 w-9 items-center justify-center rounded-xl"><ArrowLeft size={16} /></Link>
          <PremiumPageHeader eyebrow="🌉 BRIDGE" title="내부 전송" description="실시간 전환 · 수수료 0" />
        </div>
        <Premium3DCard className="p-5 space-y-3">
          <Side label="From" sym={from} amount={amount} onChange={setAmount} editable />
          <button onClick={() => setFrom(from === "PHON" ? "USDT" : "PHON")}
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-holographic shadow-glow-purple">
            <ArrowDown size={18} className="text-[var(--color-bg-0)]" />
          </button>
          <Side label="To" sym={to} amount={converted} />
          <div className="text-[11px] text-[var(--color-muted)]">기준환율 1 USDT = {RATE.toLocaleString()} PHON</div>
          <button onClick={() => toast.success("전환 완료 (mock)")}
            className="h-14 w-full rounded-2xl bg-holographic font-extrabold text-[var(--color-bg-0)]">
            전환하기
          </button>
        </Premium3DCard>
      </main>
      <BottomNav />
    </MobileShell>
  );
}

function Side({ label, sym, amount, onChange, editable }: { label: string; sym: string; amount: number; onChange?: (n: number) => void; editable?: boolean }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--color-border-hi)", background: "color-mix(in oklab, var(--color-surface) 50%, transparent)" }}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-muted)]">{label}</span>
        <span className="text-xs font-bold" style={{ color: sym === "PHON" ? "var(--color-gold)" : "var(--color-cyan)" }}>{sym}</span>
      </div>
      {editable ? (
        <input
          type="number"
          value={amount}
          onChange={(e) => onChange?.(Math.max(0, +e.target.value))}
          className="w-full bg-transparent font-numeric text-2xl font-extrabold outline-none"
        />
      ) : (
        <div className="font-numeric text-2xl font-extrabold">
          {amount.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}
        </div>
      )}
    </div>
  );
}

/**
 * DemoLowBanner — appears just above the bet panel when demo balance is low.
 * Click → switch to Real mode + go to deposit.
 */
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, AlertCircle } from "lucide-react";
import { useIsDemoLow, useBalance } from "./walletStore";
import { useMode } from "@/shared/mode/ModeContext";

export function DemoLowBanner() {
  const { mode, setMode } = useMode();
  const isLow = useIsDemoLow();
  const balance = useBalance("demo");
  const navigate = useNavigate();

  if (mode !== "demo" || !isLow) return null;

  const handle = () => {
    setMode("real");
    navigate({ to: "/deposit" }).catch(() => { /* noop */ });
  };

  return (
    <button
      onClick={handle}
      className="flex w-full items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--color-gold)_30%,transparent)] bg-[color-mix(in_oklab,var(--color-gold)_8%,transparent)] px-3 py-2 text-left transition active:scale-[0.99]"
    >
      <AlertCircle size={14} className="shrink-0 text-[var(--color-gold)]" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-[var(--color-gold)]">
          데모 크레딧 {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}원 남음
        </div>
        <div className="text-[10px] text-[var(--color-muted-2)]">
          리얼로 전환 시 첫 입금 보너스 100%
        </div>
      </div>
      <ArrowRight size={14} className="shrink-0 text-[var(--color-gold)]" />
    </button>
  );
}

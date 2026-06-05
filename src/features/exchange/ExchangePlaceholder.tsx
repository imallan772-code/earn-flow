import { useParams } from "@tanstack/react-router";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { ExchangeChart } from "./ExchangeChart";

export function ExchangePlaceholder() {
  const { symbol } = useParams({ from: "/_app/exchange/$symbol" });
  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="📈 TRADE"
        title={symbol}
        description="lightweight-charts · 데모 캔들 데이터"
      />
      <Premium3DCard className="overflow-hidden p-2">
        <ExchangeChart symbol={symbol} className="h-64 w-full" />
      </Premium3DCard>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="h-12 rounded-2xl font-semibold"
          style={{
            background: "color-mix(in oklab, var(--color-emerald) 22%, transparent)",
            color: "var(--color-emerald)",
          }}
        >
          매수
        </button>
        <button
          className="h-12 rounded-2xl font-semibold"
          style={{
            background: "color-mix(in oklab, var(--color-rose) 22%, transparent)",
            color: "var(--color-rose)",
          }}
        >
          매도
        </button>
      </div>
      <div className="text-center text-[11px] text-[var(--color-muted-2)]">
        데모 데이터 · 실거래 아님
      </div>
    </div>
  );
}

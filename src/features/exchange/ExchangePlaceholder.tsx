import { useParams } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";

export function ExchangePlaceholder() {
  const { symbol } = useParams({ from: "/_app/exchange/$symbol" });
  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="📈 TRADE"
        title={symbol}
        description="거래소 화면 — 본편 Cursor에서 lightweight-charts로 합체"
      />
      <Premium3DCard className="flex h-64 items-center justify-center p-6">
        <div className="text-center">
          <TrendingUp size={32} className="mx-auto mb-2" style={{ color: "var(--color-cyan)" }} />
          <div className="text-sm font-semibold">차트 placeholder</div>
          <div className="mt-1 text-xs text-[var(--color-muted)]">PR-4에서 트레이딩 터미널 활성화 예정</div>
        </div>
      </Premium3DCard>
      <div className="grid grid-cols-2 gap-2">
        <button className="h-12 rounded-2xl font-semibold" style={{ background: "color-mix(in oklab, var(--color-emerald) 22%, transparent)", color: "var(--color-emerald)" }}>매수</button>
        <button className="h-12 rounded-2xl font-semibold" style={{ background: "color-mix(in oklab, var(--color-rose) 22%, transparent)", color: "var(--color-rose)" }}>매도</button>
      </div>
      <div className="text-center text-[11px] text-[var(--color-muted-2)]">데모 데이터 · 실거래 아님</div>
    </div>
  );
}

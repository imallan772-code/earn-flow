import { useParams } from "@tanstack/react-router";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { ExchangeChart } from "./ExchangeChart";
import { usePlaceOrder, useTradingPositions } from "@/shared/trading/useTrading";
import { useProfile } from "@/features/profile/useProfile";
import { formatUSDT } from "@/lib/format";
import { appToast } from "@/shared/ui/toast";

export function ExchangePlaceholder() {
  const { symbol } = useParams({ from: "/_app/exchange/$symbol" });
  const { balance } = useProfile();
  const { placeOrder, isPlacing, defaultQty } = usePlaceOrder(symbol);
  const { data: positions } = useTradingPositions();
  const position = positions?.find((p) => p.symbol === symbol);

  async function handleOrder(side: "buy" | "sell") {
    try {
      await placeOrder({ side, qty: defaultQty });
      appToast.raw.success(side === "buy" ? "매수 체결" : "매도 체결");
    } catch {
      appToast.raw.error(side === "buy" ? "매수 실패 (USDT 부족?)" : "매도 실패 (포지션 부족?)");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="📈 TRADE"
        title={symbol}
        description="lightweight-charts · Supabase 캔들 · RPC 시장가"
      />
      <Premium3DCard className="overflow-hidden p-2">
        <ExchangeChart symbol={symbol} className="h-64 w-full" />
      </Premium3DCard>

      <div className="glass-2 grid grid-cols-2 gap-2 rounded-2xl p-3 text-xs">
        <div>
          <div className="text-[var(--color-muted)]">USDT 잔액</div>
          <div className="font-numeric font-bold">{formatUSDT(balance?.usdt ?? 0)}</div>
        </div>
        <div>
          <div className="text-[var(--color-muted)]">보유 포지션</div>
          <div className="font-numeric font-bold">
            {position ? `${position.qty} @ ${position.avg_price}` : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={isPlacing}
          onClick={() => void handleOrder("buy")}
          className="h-12 rounded-2xl font-semibold disabled:opacity-50"
          style={{
            background: "color-mix(in oklab, var(--color-emerald) 22%, transparent)",
            color: "var(--color-emerald)",
          }}
        >
          매수 {defaultQty}
        </button>
        <button
          disabled={isPlacing}
          onClick={() => void handleOrder("sell")}
          className="h-12 rounded-2xl font-semibold disabled:opacity-50"
          style={{
            background: "color-mix(in oklab, var(--color-rose) 22%, transparent)",
            color: "var(--color-rose)",
          }}
        >
          매도 {defaultQty}
        </button>
      </div>
      <div className="text-center text-[11px] text-[var(--color-muted-2)]">
        데모 마켓 · 실제 거래소 연동 전 · USDT는 RPC로만 변동
      </div>
    </div>
  );
}

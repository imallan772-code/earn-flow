import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { fetchMarketCandles } from "@/lib/api/trading";
import { buildFallbackCandles, toChartCandles } from "@/lib/trading/candleMapper";

const candlesKey = (symbol: string) => ["trading", "candles", symbol] as const;

export function useMarketCandles(symbol: string, limit = 48) {
  const { isConfigured } = useAuth();

  const query = useQuery({
    queryKey: [...candlesKey(symbol), limit],
    queryFn: () => fetchMarketCandles(symbol, limit),
    enabled: isConfigured,
    staleTime: 60_000,
  });

  const chartCandles =
    query.data && query.data.length > 0
      ? toChartCandles(query.data)
      : buildFallbackCandles(symbol, limit);

  return {
    candles: chartCandles,
    isLoading: isConfigured && query.isLoading,
    isLive: isConfigured && Boolean(query.data?.length),
    refetch: query.refetch,
  };
}

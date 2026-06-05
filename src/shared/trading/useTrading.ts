import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { listUserPositions, placeMarketOrder } from "@/lib/api/trading";
import { DEFAULT_ORDER_QTY } from "@/lib/trading/constants";
import type { OrderSide } from "@/lib/trading/schemas";

const POSITIONS_KEY = ["trading", "positions"] as const;

export function useTradingPositions() {
  const { status, isConfigured } = useAuth();
  const enabled = isConfigured && status === "authenticated";

  return useQuery({
    queryKey: POSITIONS_KEY,
    queryFn: listUserPositions,
    enabled,
    staleTime: 10_000,
  });
}

export function usePlaceOrder(symbol: string) {
  const queryClient = useQueryClient();
  const defaultQty =
    symbol in DEFAULT_ORDER_QTY
      ? DEFAULT_ORDER_QTY[symbol as keyof typeof DEFAULT_ORDER_QTY]
      : 0.001;

  const mutation = useMutation({
    mutationFn: ({ side, qty }: { side: OrderSide; qty?: number }) =>
      placeMarketOrder(symbol, side, qty ?? defaultQty),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: POSITIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["profile", "wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["trading", "candles", symbol] }),
      ]);
    },
  });

  return {
    placeOrder: mutation.mutateAsync,
    isPlacing: mutation.isPending,
    defaultQty,
    lastError: mutation.error,
  };
}

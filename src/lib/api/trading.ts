import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import {
  candlesSchema,
  orderSideSchema,
  placeOrderResultSchema,
  positionsSchema,
  type CandleRow,
  type OrderSide,
  type TradingPosition,
} from "@/lib/trading/schemas";

export async function fetchMarketCandles(symbol: string, limit = 48): Promise<CandleRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("fetch_market_candles", {
    p_symbol: symbol,
    p_limit: limit,
  });
  if (error) throw error;
  return candlesSchema.parse(data ?? []);
}

export async function listUserPositions(): Promise<TradingPosition[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("list_user_positions");
  if (error) throw error;
  return positionsSchema.parse(data ?? []);
}

export async function placeMarketOrder(symbol: string, side: OrderSide, qty: number) {
  const parsedSide = orderSideSchema.parse(side);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("place_market_order", {
    p_symbol: symbol,
    p_side: parsedSide,
    p_qty: qty,
  });
  if (error) throw error;
  const result = placeOrderResultSchema.parse(data);
  const balance = result.balance as WalletBalance | undefined;
  return { ...result, balance };
}

export async function logGameRound(game: string, roundId: string, betAmount = 0, payoutAmount = 0) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("log_game_round", {
    p_game: game,
    p_round_id: roundId,
    p_bet_amount: betAmount,
    p_payout_amount: payoutAmount,
  });
  if (error) throw error;
  return data;
}

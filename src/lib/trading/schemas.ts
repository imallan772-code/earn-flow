import { z } from "zod";

export const orderSideSchema = z.enum(["buy", "sell"]);

export const candleRowSchema = z.object({
  time: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  open: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  high: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  low: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  close: z.union([z.number(), z.string()]).transform((v) => Number(v)),
});

export const candlesSchema = z.array(candleRowSchema);

export const positionSchema = z.object({
  user_id: z.string().optional(),
  symbol: z.string(),
  qty: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  avg_price: z.union([z.number(), z.string()]).transform((v) => Number(v)),
});

export const positionsSchema = z.array(positionSchema);

export const placeOrderResultSchema = z.object({
  order: z.record(z.unknown()).optional(),
  balance: z.record(z.unknown()).optional(),
});

export type CandleRow = z.infer<typeof candleRowSchema>;
export type OrderSide = z.infer<typeof orderSideSchema>;
export type TradingPosition = z.infer<typeof positionSchema>;

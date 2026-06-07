import { z } from "zod";

const autoBetStrategySchema = z.enum([
  "Flat",
  "Martingale",
  "AntiMartingale",
  "Fibonacci",
  "DAlembert",
]);

export const autoBetConfigSchema = z.object({
  strategy: autoBetStrategySchema,
  baseBet: z.number().positive(),
  numberOfBets: z.number().int().nonnegative(),
  onWinIncreasePct: z.number(),
  onLossIncreasePct: z.number(),
  stopOnProfit: z.number().nonnegative(),
  stopOnLoss: z.number().nonnegative(),
});

export const autoBetSessionSchema = z.object({
  id: z.string().uuid(),
  game: z.enum(["dice", "limbo", "wheel", "crash", "plinko", "mines"]),
  status: z.enum(["running", "paused", "stopping", "stopped", "completed", "error"]),
  config: autoBetConfigSchema,
  bet_params: z.record(z.unknown()),
  current_bet: z.number().int().positive(),
  bets_placed: z.number().int().nonnegative(),
  pnl: z.number().int(),
  fib_index: z.number().int().nonnegative().optional(),
  stop_reason: z
    .enum(["count", "profit", "loss", "manual", "limit", "error"])
    .nullable()
    .optional(),
  last_error: z.string().nullable().optional(),
  next_tick_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_at: z.string().optional(),
});

export const autoBetListItemSchema = z.object({
  id: z.string().uuid(),
  game: z.string(),
  status: z.string(),
  current_bet: z.number().int(),
  bets_placed: z.number().int(),
  pnl: z.number().int(),
  stop_reason: z.string().nullable().optional(),
  next_tick_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_at: z.string().optional(),
});

export type AutoBetConfigPayload = z.infer<typeof autoBetConfigSchema>;
export type AutoBetSession = z.infer<typeof autoBetSessionSchema>;
export type AutoBetListItem = z.infer<typeof autoBetListItemSchema>;

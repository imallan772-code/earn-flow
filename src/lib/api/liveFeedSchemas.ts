/**
 * Live feed row schemas — Zod SSOT for live_bets table reads.
 */
import { z } from "zod";

export const liveBetStatusSchema = z.enum(["pending", "cashout", "bust", "win", "loss"]);

export const liveBetRowSchema = z.object({
  id: z.string().uuid(),
  event_key: z.string(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  game: z.string(),
  amount: z.number().int().nonnegative(),
  multiplier: z.number().nullable(),
  profit: z.number().int().nullable(),
  status: liveBetStatusSchema,
  mode: z.enum(["demo", "real"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type LiveBetRow = z.infer<typeof liveBetRowSchema>;

export const liveBetRowsSchema = z.array(liveBetRowSchema);

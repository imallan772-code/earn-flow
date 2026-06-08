import { z } from "zod";
import { normalizeRevealedTiles } from "@/lib/gameSessions/minesSessionUtils";

const revealedTilesSchema = z.preprocess((val) => normalizeRevealedTiles(val), z.array(z.number()));

export const gameSessionRowSchema = z.object({
  session_id: z.string().uuid(),
  game: z.string(),
  round_id: z.string(),
  bet_amount: z.coerce.number(),
  client_state: z.record(z.unknown()),
  status: z.enum(["active", "settled"]),
  updated_at: z.string().optional(),
});

export type GameSessionRow = z.infer<typeof gameSessionRowSchema>;

export const minesStartResultSchema = z.object({
  round_id: z.string(),
  bet_amount: z.number(),
  mine_count: z.number(),
  nonce: z.coerce.number(),
  revealed: revealedTilesSchema.default([]),
  multiplier: z.number().default(1),
  debit: z.record(z.unknown()).optional(),
  idempotent: z.boolean().optional(),
  resumed: z.boolean().optional(),
});

export const minesRevealResultSchema = z.object({
  hit: z.boolean(),
  tile: z.number(),
  round_id: z.string(),
  multiplier: z.number(),
  revealed: revealedTilesSchema,
  next_multiplier: z.number().optional(),
  mines: z.array(z.number()).optional(),
});

export const minesCashoutResultSchema = z.object({
  round_id: z.string(),
  gross_payout: z.number(),
  revealed: revealedTilesSchema,
  credit: z.record(z.unknown()).optional(),
});

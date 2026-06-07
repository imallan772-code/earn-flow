/**
 * Provably Fair public verify — Zod SSOT (ROUND Q-PR1).
 */
import { z } from "zod";

export const verifyGameSchema = z.enum(["crash", "dice", "limbo", "wheel", "mines", "plinko"]);

export type VerifyGame = z.infer<typeof verifyGameSchema>;

export const verifyInputSchema = z.object({
  game: verifyGameSchema,
  serverSeed: z.string().trim().min(1, "server seed required"),
  serverSeedHash: z.string().trim().optional(),
  clientSeed: z.string().trim().min(1, "client seed required"),
  nonce: z.coerce.number().int().nonnegative(),
  mineCount: z.coerce.number().int().min(1).max(24).optional(),
  segments: z.coerce
    .number()
    .refine((v) => v === 10 || v === 20 || v === 30, "segments must be 10, 20, or 30")
    .optional(),
  risk: z.enum(["low", "medium", "high"]).optional(),
  rows: z.coerce
    .number()
    .refine((v) => v === 8 || v === 12 || v === 16, "rows must be 8, 12, or 16")
    .optional(),
});

export type VerifyInput = z.infer<typeof verifyInputSchema>;

export const verifySearchSchema = z
  .object({
    game: verifyGameSchema.optional(),
    serverSeed: z.string().optional(),
    serverSeedHash: z.string().optional(),
    hash: z.string().optional(),
    clientSeed: z.string().optional(),
    nonce: z.coerce.number().optional(),
    mineCount: z.coerce.number().optional(),
    segments: z.coerce.number().optional(),
    risk: z.enum(["low", "medium", "high"]).optional(),
    rows: z.coerce.number().optional(),
  })
  .transform((raw) => ({
    game: raw.game ?? "crash",
    serverSeed: raw.serverSeed ?? "",
    serverSeedHash: raw.serverSeedHash ?? raw.hash ?? "",
    clientSeed: raw.clientSeed ?? "",
    nonce: raw.nonce ?? 0,
    mineCount: raw.mineCount,
    segments: raw.segments,
    risk: raw.risk,
    rows: raw.rows,
  }));

export type VerifySearch = z.infer<typeof verifySearchSchema>;

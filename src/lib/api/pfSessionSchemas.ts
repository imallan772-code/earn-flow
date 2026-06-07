import { z } from "zod";

export const pfSessionSchema = z.object({
  id: z.string().uuid(),
  game: z.string(),
  server_seed: z.string(),
  server_seed_hash: z.string(),
  client_seed: z.string(),
  nonce: z.number().int().nonnegative(),
  status: z.enum(["active", "rotated"]),
});

export type PfSession = z.infer<typeof pfSessionSchema>;

export const pfSessionRotateSchema = z.object({
  previous: z
    .object({
      id: z.string().uuid(),
      server_seed: z.string(),
      server_seed_hash: z.string(),
      nonce: z.number().int().nonnegative(),
    })
    .nullable(),
  current: pfSessionSchema,
});

export type PfSessionRotateResult = z.infer<typeof pfSessionRotateSchema>;

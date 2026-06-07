import { z } from "zod";

export const userSettingsSchema = z.object({
  user_id: z.string().uuid(),
  preferred_mode: z.enum(["demo", "real"]),
  safety_tier: z.enum(["tier_0_new", "tier_1_regular", "tier_2_vip"]),
  region: z.enum(["region_kr", "region_global", "region_restricted"]),
  daily_loss_limit_phon: z.number().int().positive().nullable(),
  daily_loss_limit_pct: z.number().int().min(1).max(99).nullable(),
  max_consecutive_losses: z.number().int().min(1).max(100).nullable(),
  daily_round_limit: z.number().int().min(1).max(50000),
  auto_bet_consent_at: z.string().nullable(),
  updated_at: z.string(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

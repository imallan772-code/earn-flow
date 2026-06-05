import { z } from "zod";

export const missionKindSchema = z.enum(["daily", "limited", "viral", "onboarding"]);

export const userMissionSchema = z.object({
  id: z.string(),
  title: z.string(),
  reward: z.number(),
  kind: missionKindSchema,
  urgency: z.string().nullable().optional(),
  total: z.number(),
  sort_order: z.number().optional(),
  progress: z.number(),
  claimed_at: z.string().nullable().optional(),
  can_claim: z.boolean().optional(),
});

export const userMissionsSchema = z.array(userMissionSchema);

export const claimMissionResultSchema = z.object({
  reward: z.number(),
  balance: z.record(z.unknown()).optional(),
  mission_id: z.string(),
});

export type UserMission = z.infer<typeof userMissionSchema>;
export type ClaimMissionResult = z.infer<typeof claimMissionResultSchema>;

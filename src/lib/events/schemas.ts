import { z } from "zod";

export const eventStatusSchema = z.enum(["진행중", "예정", "종료"]);

export const eventRowSchema = z.object({
  id: z.string(),
  status: eventStatusSchema,
  title: z.string(),
  tagline: z.string(),
  body: z.string(),
  reward_preview: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  participants: z.number(),
  cap: z.number().nullable().optional(),
  cta_label: z.string(),
  terms: z.union([z.array(z.string()), z.string()]),
  bg_from: z.string(),
  bg_to: z.string(),
  progress: z.union([z.number(), z.string()]).transform((v) => Number(v)),
});

export const eventsSchema = z.array(eventRowSchema);

export const leaderboardRowSchema = z.object({
  rank: z.number(),
  nickname: z.string(),
  score: z.union([z.number(), z.string()]).transform((v) => Number(v)),
});

export const leaderboardSchema = z.array(leaderboardRowSchema);

export type EventRow = z.infer<typeof eventRowSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>;

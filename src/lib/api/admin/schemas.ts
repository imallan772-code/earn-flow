import { z } from "zod";
import { eventRowSchema, eventsSchema } from "@/lib/events/schemas";
import { noticeRowSchema, noticesSchema } from "@/lib/notices/schemas";

export const adminDashboardStatsSchema = z.object({
  total_users: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  signups_today: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  published_events: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  published_notices: z.union([z.number(), z.string()]).transform((v) => Number(v)),
});

export const adminNoticeInputSchema = z.object({
  id: z.string().min(1),
  category: noticeRowSchema.shape.category,
  title: z.string().min(1),
  excerpt: z.string(),
  body: z.string(),
  pinned: z.boolean(),
  published_at: z.string(),
  author: z.string(),
  is_published: z.boolean().default(true),
});

export const adminEventInputSchema = z.object({
  id: z.string().min(1),
  status: eventRowSchema.shape.status,
  title: z.string().min(1),
  tagline: z.string(),
  body: z.string(),
  reward_preview: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  participants: z.number().int().nonnegative(),
  cap: z.number().int().positive().nullable().optional(),
  cta_label: z.string(),
  terms: z.array(z.string()),
  bg_from: z.string(),
  bg_to: z.string(),
  progress: z.number().min(0).max(1),
  is_published: z.boolean().default(true),
});

export { eventsSchema, noticesSchema, eventRowSchema, noticeRowSchema };

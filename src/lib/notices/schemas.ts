import { z } from "zod";

export const noticeCategorySchema = z.enum(["공지", "업데이트", "점검", "보안"]);

export const noticeRowSchema = z.object({
  id: z.string(),
  category: noticeCategorySchema,
  title: z.string(),
  excerpt: z.string(),
  body: z.string(),
  pinned: z.boolean(),
  published_at: z.string(),
  author: z.string(),
  is_published: z.boolean().optional(),
});

export const noticesSchema = z.array(noticeRowSchema);

export type NoticeRow = z.infer<typeof noticeRowSchema>;
export type NoticeCategory = z.infer<typeof noticeCategorySchema>;

import { getSupabaseClient } from "@/integrations/supabase/client";
import { noticesSchema, type NoticeRow } from "@/lib/notices/schemas";

export function toNotice(row: NoticeRow) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    pinned: row.pinned,
    publishedAt: row.published_at,
    author: row.author,
  };
}

export type NoticeView = ReturnType<typeof toNotice>;

export async function listNotices(): Promise<NoticeView[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("list_notices");
  if (error) throw error;
  return noticesSchema.parse(data ?? []).map(toNotice);
}

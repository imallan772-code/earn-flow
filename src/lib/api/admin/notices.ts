import { getSupabaseClient } from "@/integrations/supabase/client";
import { toNotice } from "@/lib/api/notices";
import { adminNoticeInputSchema, noticeRowSchema, noticesSchema } from "@/lib/api/admin/schemas";
import type { NoticeView } from "@/lib/api/notices";

export type AdminNoticeView = NoticeView & { isPublished: boolean };

function toAdminNotice(row: ReturnType<typeof noticeRowSchema.parse>) {
  return { ...toNotice(row), isPublished: row.is_published ?? true };
}

export async function adminListNotices(): Promise<AdminNoticeView[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_notices");
  if (error) throw error;
  return noticesSchema.parse(data ?? []).map(toAdminNotice);
}

export async function adminUpsertNotice(input: unknown): Promise<AdminNoticeView> {
  const payload = adminNoticeInputSchema.parse(input);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_upsert_notice", {
    p_payload: payload,
  });
  if (error) throw error;
  return toAdminNotice(noticeRowSchema.parse(data));
}

export async function adminDeleteNotice(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_delete_notice", { p_id: id });
  if (error) throw error;
}

import { z } from "zod";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { toAppEvent } from "@/lib/api/events";
import { adminEventInputSchema, eventRowSchema } from "@/lib/api/admin/schemas";
import type { AppEventView } from "@/lib/api/events";

export type AdminEventView = AppEventView & { isPublished: boolean };

const adminEventRowSchema = eventRowSchema.extend({
  is_published: z.boolean().optional(),
});

const adminEventsSchema = z.array(adminEventRowSchema);

function toAdminEvent(row: z.infer<typeof adminEventRowSchema>) {
  return { ...toAppEvent(row), isPublished: row.is_published ?? true };
}

export async function adminListEvents(): Promise<AdminEventView[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_events");
  if (error) throw error;
  return adminEventsSchema.parse(data ?? []).map(toAdminEvent);
}

export async function adminUpsertEvent(input: unknown): Promise<AdminEventView> {
  const payload = adminEventInputSchema.parse(input);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_upsert_event", {
    p_payload: payload,
  });
  if (error) throw error;
  return toAdminEvent(adminEventRowSchema.parse(data));
}

export async function adminDeleteEvent(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_delete_event", { p_id: id });
  if (error) throw error;
}

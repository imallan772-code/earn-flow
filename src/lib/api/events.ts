import { getSupabaseClient } from "@/integrations/supabase/client";
import {
  eventsSchema,
  leaderboardSchema,
  type EventRow,
  type LeaderboardRow,
} from "@/lib/events/schemas";

function normalizeTerms(terms: EventRow["terms"]): string[] {
  if (Array.isArray(terms)) return terms;
  try {
    const parsed = JSON.parse(terms);
    return Array.isArray(parsed) ? parsed.map(String) : [String(terms)];
  } catch {
    return [String(terms)];
  }
}

export function toAppEvent(row: EventRow) {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    tagline: row.tagline,
    body: row.body,
    rewardPreview: row.reward_preview,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    participants: row.participants,
    cap: row.cap ?? undefined,
    ctaLabel: row.cta_label,
    terms: normalizeTerms(row.terms),
    bgFrom: row.bg_from,
    bgTo: row.bg_to,
    progress: Number(row.progress),
  };
}

export type AppEventView = ReturnType<typeof toAppEvent>;

export async function listEvents(): Promise<AppEventView[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("list_events");
  if (error) throw error;
  return eventsSchema.parse(data ?? []).map(toAppEvent);
}

export async function joinEvent(eventId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("join_event", { p_event_id: eventId });
  if (error) throw error;
  return data as { joined: boolean; participants: number; progress?: number };
}

export async function getEventLeaderboard(eventId: string): Promise<LeaderboardRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_event_leaderboard", {
    p_event_id: eventId,
  });
  if (error) throw error;
  return leaderboardSchema.parse(data ?? []);
}

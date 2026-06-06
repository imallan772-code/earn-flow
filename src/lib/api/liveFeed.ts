/**
 * Live feed API — read + Realtime subscription SSOT (P-PR1).
 *
 * Real bets mirror from game_rounds trigger; demo/bot FOMO stays client-only.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { getSupabaseEnv } from "@/integrations/supabase/env";
import { liveBetRowSchema, liveBetRowsSchema } from "./liveFeedSchemas";

export function isLiveFeedRealtimeEnabled(): boolean {
  return import.meta.env.VITE_LIVE_FEED_REALTIME !== "false";
}

function hasSupabaseConfig(): boolean {
  try {
    getSupabaseEnv();
    return true;
  } catch {
    return false;
  }
}

export async function fetchRecentLiveBets(limit = 50) {
  if (!hasSupabaseConfig()) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("live_bets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return liveBetRowsSchema.parse(data ?? []);
}

export type LiveBetChangeHandler = (row: ReturnType<typeof liveBetRowSchema.parse>) => void;

let channel: RealtimeChannel | null = null;
let listenerCount = 0;
let onInsert: LiveBetChangeHandler | null = null;
let onUpdate: LiveBetChangeHandler | null = null;

function teardownChannel() {
  if (!channel) return;
  void getSupabaseClient().removeChannel(channel);
  channel = null;
}

export function subscribeLiveBetsRealtime(handlers: {
  onInsert: LiveBetChangeHandler;
  onUpdate: LiveBetChangeHandler;
}) {
  if (!isLiveFeedRealtimeEnabled() || !hasSupabaseConfig()) {
    return () => undefined;
  }

  listenerCount += 1;
  onInsert = handlers.onInsert;
  onUpdate = handlers.onUpdate;

  if (!channel) {
    const supabase = getSupabaseClient();
    channel = supabase
      .channel("live_bets:public")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_bets" },
        (payload) => {
          const row = liveBetRowSchema.safeParse(payload.new);
          if (row.success) onInsert?.(row.data);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_bets" },
        (payload) => {
          const row = liveBetRowSchema.safeParse(payload.new);
          if (row.success) onUpdate?.(row.data);
        },
      )
      .subscribe();
  }

  return unsubscribeLiveBetsRealtime;
}

function unsubscribeLiveBetsRealtime() {
  listenerCount = Math.max(0, listenerCount - 1);
  if (listenerCount > 0) return;
  teardownChannel();
  onInsert = null;
  onUpdate = null;
}

/**
 * Additive Realtime adapter — merges live_bets into LiveBetsStore.
 * Bot FOMO baseline unchanged; zero real users = identical feed.
 */
import {
  fetchRecentLiveBets,
  isLiveFeedRealtimeEnabled,
  subscribeLiveBetsRealtime,
} from "@/lib/api/liveFeed";
import { mapLiveBetRow } from "@/lib/api/liveFeedMap";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { liveBetsStore } from "./LiveBetsStore";

let bootCount = 0;
let stopRealtime: (() => void) | null = null;
let authUnsub: (() => void) | null = null;
let hydrated = false;
let currentUserId: string | null = null;

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function hydrateRecent() {
  if (hydrated) return;
  hydrated = true;
  try {
    const rows = await fetchRecentLiveBets(50);
    for (const row of rows.reverse()) {
      const bet = mapLiveBetRow(row, currentUserId);
      if (bet) liveBetsStore.push(bet);
    }
  } catch {
    // Quiet — bot baseline remains
  }
}

function applyRow(row: Parameters<typeof mapLiveBetRow>[0]) {
  const bet = mapLiveBetRow(row, currentUserId);
  if (bet) liveBetsStore.push(bet);
}

export function bootLiveBetsRealtime(): () => void {
  if (!isLiveFeedRealtimeEnabled()) return () => undefined;

  bootCount += 1;
  if (bootCount > 1) {
    return () => {
      bootCount = Math.max(0, bootCount - 1);
    };
  }

  void (async () => {
    currentUserId = await resolveCurrentUserId();
    await hydrateRecent();
    stopRealtime = subscribeLiveBetsRealtime({
      onInsert: applyRow,
      onUpdate: applyRow,
    });
  })();

  const supabase = getSupabaseClient();
  const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
    currentUserId = session?.user.id ?? null;
  });
  authUnsub = () => authSub.subscription.unsubscribe();

  return () => {
    bootCount = Math.max(0, bootCount - 1);
    if (bootCount > 0) return;
    authUnsub?.();
    authUnsub = null;
    stopRealtime?.();
    stopRealtime = null;
    hydrated = false;
    currentUserId = null;
  };
}

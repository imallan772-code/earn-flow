/**
 * Single Supabase Realtime subscription for wallet_balances per user.
 * Multiple useProfile()/useGameWallet() hooks share one channel — adding
 * postgres_changes after subscribe() throws on the same channel name.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { WalletBalance } from "@/integrations/supabase/types";
import { syncRealBalance } from "@/shared/wallet/walletStore";

export const PROFILE_WALLET_QUERY_KEY = ["profile", "wallet"] as const;

let channel: RealtimeChannel | null = null;
let boundUserId: string | null = null;
let listenerCount = 0;
let queryClientRef: QueryClient | null = null;

function teardownChannel() {
  if (!channel) return;
  void getSupabaseClient().removeChannel(channel);
  channel = null;
  boundUserId = null;
}

export function subscribeWalletBalanceRealtime(userId: string, queryClient: QueryClient) {
  listenerCount += 1;
  queryClientRef = queryClient;

  if (channel && boundUserId === userId) {
    return unsubscribeWalletBalanceRealtime;
  }

  teardownChannel();
  boundUserId = userId;

  const supabase = getSupabaseClient();
  channel = supabase
    .channel(`wallet:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "wallet_balances",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as WalletBalance;
        if (row?.phon != null) syncRealBalance(row.phon);
        void queryClientRef?.invalidateQueries({ queryKey: PROFILE_WALLET_QUERY_KEY });
      },
    )
    .subscribe();

  return unsubscribeWalletBalanceRealtime;
}

function unsubscribeWalletBalanceRealtime() {
  listenerCount = Math.max(0, listenerCount - 1);
  if (listenerCount > 0) return;
  teardownChannel();
  queryClientRef = null;
}

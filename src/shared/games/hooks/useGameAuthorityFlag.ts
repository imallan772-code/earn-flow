import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Server-side feature flag with deterministic rollout % (GA plan §4).
 * Returns false when offline, anon, or flag disabled.
 */
export function useGameAuthorityFlag(key: string): boolean {
  const { status } = useAuth();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || status !== "authenticated") {
      setEnabled(false);
      return;
    }

    let alive = true;
    void (async () => {
      try {
        const { data, error } = await getSupabaseClient().rpc("game_authority_flag_v1", {
          p_key: key,
        });
        if (!alive) return;
        setEnabled(!error && data === true);
      } catch {
        if (alive) setEnabled(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [key, status]);

  return enabled;
}

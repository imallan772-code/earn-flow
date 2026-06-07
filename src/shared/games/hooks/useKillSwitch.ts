import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/env";

export type DegradeLevel = "L0" | "L2" | "L3";

export interface KillSwitchState {
  level: DegradeLevel;
  killSwitch: boolean;
  readOnlyResume: boolean;
  loading: boolean;
}

const INITIAL: KillSwitchState = {
  level: "L0",
  killSwitch: false,
  readOnlyResume: true,
  loading: true,
};

/**
 * Polls `kill_switch_status_v1` every 30 s so the banner reflects live state.
 * Returns L0 (normal) while loading or when Supabase is unconfigured.
 */
export function useKillSwitch(): KillSwitchState {
  const [state, setState] = useState<KillSwitchState>(INITIAL);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({ level: "L0", killSwitch: false, readOnlyResume: true, loading: false });
      return;
    }

    let alive = true;

    async function fetch() {
      try {
        const { data, error } = await getSupabaseClient().rpc("kill_switch_status_v1");
        if (!alive) return;
        if (error || !data) {
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        const row = data as { kill_switch: boolean; read_only_resume: boolean; level: string };
        setState({
          level: (row.level ?? "L0") as DegradeLevel,
          killSwitch: Boolean(row.kill_switch),
          readOnlyResume: Boolean(row.read_only_resume),
          loading: false,
        });
      } catch {
        if (alive) setState((s) => ({ ...s, loading: false }));
      }
    }

    void fetch();
    const interval = setInterval(() => void fetch(), 30_000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return state;
}

/**
 * GA-J — server auto-bet session sync (Realtime + poll fallback).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import {
  autoBetCreate,
  autoBetGrantConsent,
  autoBetList,
  autoBetStop,
  autoBetSync,
  isAutoBetConsentRequired,
  type ServerAutoBetGame,
} from "@/lib/api/autoBetSession";
import type { AutoBetConfigPayload, AutoBetSession } from "@/lib/api/autoBetSessionSchemas";
import { useGameAuthorityFlag } from "./useGameAuthorityFlag";

export function useServerAutoBet(game?: ServerAutoBetGame) {
  const flagOn = useGameAuthorityFlag("auto_bet_server");
  const enabled = flagOn && Boolean(game);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AutoBetSession | null>(null);
  const [consentGranted, setConsentGranted] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshList = useCallback(async () => {
    if (!enabled || !isSupabaseConfigured()) return;
    try {
      const items = await autoBetList();
      setActiveCount(items.length);
      const mine = game ? items.find((i) => i.game === game && i.status === "running") : undefined;
      if (mine && !sessionId) setSessionId(mine.id);
    } catch {
      /* offline */
    }
  }, [enabled, game, sessionId]);

  const syncSession = useCallback(
    async (id: string) => {
      const row = await autoBetSync(id);
      setSession(row);
      if (row.status === "stopped" || row.status === "completed" || row.status === "error") {
        setSessionId(null);
      }
      return row;
    },
    [],
  );

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!sessionId || !enabled) return;
    void syncSession(sessionId).catch(() => setSessionId(null));

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`auto-bet-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auto_bet_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => {
          void syncSession(sessionId).catch(() => undefined);
        },
      )
      .subscribe();

    pollRef.current = setInterval(() => {
      void syncSession(sessionId).catch(() => undefined);
    }, 2000);

    return () => {
      void supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, enabled, syncSession]);

  const grantConsent = useCallback(async () => {
    await autoBetGrantConsent();
    setConsentGranted(true);
  }, []);

  const startServer = useCallback(
    async (config: AutoBetConfigPayload, betParams: Record<string, unknown>) => {
      if (!enabled || !game) return null;
      try {
        const row = await autoBetCreate({ game, config, betParams });
        setSessionId(row.id);
        setSession(row);
        setConsentGranted(true);
        void refreshList();
        return row;
      } catch (err) {
        if (isAutoBetConsentRequired(err)) {
          await grantConsent();
          const row = await autoBetCreate({ game, config, betParams });
          setSessionId(row.id);
          setSession(row);
          void refreshList();
          return row;
        }
        throw err;
      }
    },
    [enabled, game, grantConsent, refreshList],
  );

  const stopServer = useCallback(async () => {
    if (!sessionId) return;
    await autoBetStop(sessionId);
    setSessionId(null);
    setSession(null);
    void refreshList();
  }, [sessionId, refreshList]);

  const serverRunning =
    enabled &&
    (session?.status === "running" || session?.status === "paused" || session?.status === "stopping");

  return {
    serverAutoBetEnabled: enabled,
    serverRunning,
    sessionId,
    session,
    activeCount,
    consentGranted,
    grantConsent,
    startServer,
    stopServer,
    refreshList,
  };
}

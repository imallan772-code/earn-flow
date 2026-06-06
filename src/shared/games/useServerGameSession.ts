/**
 * Real-mode session sync — Stake-like resume across navigation/devices.
 * Demo mode: no-op (localStorage SSOT).
 */
import { useCallback, useEffect, useRef } from "react";
import {
  clearGameActiveSession,
  getGameActiveSession,
  syncGameActiveSession,
} from "@/lib/api/gameSessions";

export function useServerGameSession(
  game: string,
  mode: string,
  enabled: boolean,
  getSnapshot: () => {
    roundId: string;
    betAmount: number;
    clientState: Record<string, unknown>;
  } | null,
  onHydrate?: (clientState: Record<string, unknown>, roundId: string, betAmount: number) => void,
) {
  const hydratedRef = useRef(false);
  const getRef = useRef(getSnapshot);
  getRef.current = getSnapshot;

  useEffect(() => {
    if (!enabled || mode !== "real") return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void getGameActiveSession(game)
      .then((row) => {
        if (!row || !onHydrate) return;
        onHydrate(row.client_state, row.round_id, row.bet_amount);
      })
      .catch(() => undefined);
  }, [enabled, mode, game, onHydrate]);

  const sync = useCallback(() => {
    if (mode !== "real") return;
    const snap = getRef.current();
    if (!snap) return;
    void syncGameActiveSession(game, snap.roundId, snap.betAmount, snap.clientState).catch(
      () => undefined,
    );
  }, [mode, game]);

  const clear = useCallback(
    (roundId: string) => {
      if (mode !== "real") return;
      void clearGameActiveSession(game, roundId).catch(() => undefined);
    },
    [mode, game],
  );

  return { sync, clear };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import {
  pfSessionCreateOrGet,
  pfSessionRotate,
  pfSessionSetClientSeed,
} from "@/lib/api/pfSession";
import type { PfSession } from "@/lib/api/pfSessionSchemas";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";

export interface PfSessionState {
  serverSeed: string;
  commitHash: string;
  clientSeed: string;
  nonce: number;
  sessionId: string | null;
  loading: boolean;
  ready: boolean;
  legacyFallback: boolean;
}

export interface UsePfSessionOptions {
  /** Game store client seed — synced to pf_sessions on each refresh. */
  clientSeed?: string;
}

export interface UsePfSessionResult extends PfSessionState {
  refresh: () => Promise<void>;
  setClientSeed: (seed: string) => Promise<void>;
  rotate: () => Promise<void>;
}

function sessionToState(session: PfSession): Omit<PfSessionState, "loading" | "ready" | "legacyFallback"> {
  return {
    serverSeed: session.server_seed,
    commitHash: session.server_seed_hash,
    clientSeed: session.client_seed,
    nonce: session.nonce,
    sessionId: session.id,
  };
}

async function legacyState(legacySeed: string, clientSeed: string): Promise<PfSessionState> {
  const commitHash = await commitServerSeed(legacySeed);
  return {
    serverSeed: legacySeed,
    commitHash,
    clientSeed,
    nonce: 0,
    sessionId: null,
    loading: false,
    ready: true,
    legacyFallback: true,
  };
}

function resolvedClientSeed(clientSeed: string | undefined, defaultClientSeed: string): string {
  const trimmed = clientSeed?.trim().slice(0, 64);
  return trimmed || defaultClientSeed;
}

/**
 * PF session SSOT — replaces hardcoded SERVER_SEED per game.
 * Falls back to legacy seed when Supabase auth/RPC unavailable (local dev).
 */
export function usePfSession(
  game: string,
  legacySeed: string,
  defaultClientSeed = "phonara-player-001",
  options?: UsePfSessionOptions,
): UsePfSessionResult {
  const { user, status } = useAuth();
  const storeClientSeed = options?.clientSeed;
  const [state, setState] = useState<PfSessionState>(() => ({
    serverSeed: legacySeed,
    commitHash: "",
    clientSeed: resolvedClientSeed(storeClientSeed, defaultClientSeed),
    nonce: 0,
    sessionId: null,
    loading: true,
    ready: false,
    legacyFallback: true,
  }));

  const refresh = useCallback(async () => {
    const seed = resolvedClientSeed(storeClientSeed, defaultClientSeed);
    if (!isSupabaseConfigured() || status !== "authenticated" || !user) {
      setState(await legacyState(legacySeed, seed));
      return;
    }
    try {
      const session = await pfSessionCreateOrGet(game, seed);
      setState({
        ...sessionToState(session),
        loading: false,
        ready: true,
        legacyFallback: false,
      });
    } catch {
      setState(await legacyState(legacySeed, seed));
    }
  }, [game, legacySeed, defaultClientSeed, status, user, storeClientSeed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setClientSeed = useCallback(
    async (seed: string) => {
      const trimmed = seed.trim().slice(0, 64) || defaultClientSeed;
      if (state.legacyFallback) {
        const commitHash = await commitServerSeed(state.serverSeed);
        setState((s) => ({ ...s, clientSeed: trimmed, nonce: 0, commitHash }));
        return;
      }
      const session = await pfSessionSetClientSeed(game, trimmed);
      setState((s) => ({
        ...s,
        ...sessionToState(session),
        loading: false,
        ready: true,
        legacyFallback: false,
      }));
    },
    [defaultClientSeed, game, state.legacyFallback, state.serverSeed],
  );

  const rotate = useCallback(async () => {
    if (state.legacyFallback) {
      const commitHash = await commitServerSeed(state.serverSeed);
      setState((s) => ({ ...s, commitHash, nonce: 0 }));
      return;
    }
    const result = await pfSessionRotate(game);
    setState((s) => ({
      ...s,
      ...sessionToState(result.current),
      loading: false,
      ready: true,
      legacyFallback: false,
    }));
  }, [game, state.legacyFallback, state.serverSeed]);

  return useMemo(
    () => ({
      ...state,
      refresh,
      setClientSeed,
      rotate,
    }),
    [state, refresh, setClientSeed, rotate],
  );
}

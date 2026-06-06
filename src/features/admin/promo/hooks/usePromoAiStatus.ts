/**
 * PromoShell + StudioPanel 공유 훅.
 * `getPromoAiStatus` 1회 호출 → provider 상태 캐싱 (mount per route subtree).
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPromoAiStatus } from "@/lib/promo/promo.functions";

export type PromoAiProvider = "gemini-direct" | "lovable-gateway" | null;

export interface PromoAiStatus {
  loading: boolean;
  configured: boolean;
  provider: PromoAiProvider;
}

interface CacheEntry {
  configured: boolean;
  provider: PromoAiProvider;
}

let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;

export function usePromoAiStatus(): PromoAiStatus {
  const fetchStatus = useServerFn(getPromoAiStatus);
  const [state, setState] = useState<PromoAiStatus>(() =>
    cache
      ? { loading: false, configured: cache.configured, provider: cache.provider }
      : { loading: true, configured: false, provider: null },
  );

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    if (!inflight) {
      inflight = fetchStatus().then((r) => {
        const entry: CacheEntry = {
          configured: Boolean(r.configured),
          provider: (r.provider as PromoAiProvider) ?? null,
        };
        cache = entry;
        return entry;
      });
    }
    inflight
      .then((entry) => {
        if (cancelled) return;
        setState({ loading: false, configured: entry.configured, provider: entry.provider });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ loading: false, configured: false, provider: null });
      })
      .finally(() => {
        inflight = null;
      });
    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  return state;
}

/** test-only */
export function __resetPromoAiStatusCache() {
  cache = null;
  inflight = null;
}

/**
 * GameMiniStats — sparkline of recent multipliers per game.
 *
 * Subscribes to LiveBetsStore; falls back to deterministic mock series (FOMO)
 * until enough settled wins exist. Dashed line was the old empty-state placeholder.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { lobbySparklineSeries, polylineFromSeries } from "@/shared/games/lobby/lobbyLiveDisplay";
import { liveBetsStore, type LiveGame } from "@/shared/livefeed/LiveBetsStore";

interface Props {
  game: LiveGame;
  width?: number;
  height?: number;
  accent?: string;
  limit?: number;
}

const FALLBACK_ACCENT = "var(--color-cyan)";

export function GameMiniStats({
  game,
  width = 64,
  height = 18,
  accent = FALLBACK_ACCENT,
  limit = 24,
}: Props) {
  const bets = useSyncExternalStore(liveBetsStore.subscribe, liveBetsStore.getSnapshot, () =>
    liveBetsStore.getSnapshot(),
  );
  const [reduced, setReduced] = useState(false);
  const [mockTick, setMockTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const liveSeries = useMemo(() => {
    return bets
      .filter((b) => b.game === game && b.multiplier != null && b.multiplier > 0)
      .slice(0, limit)
      .reverse()
      .map((b) => b.multiplier as number);
  }, [bets, game, limit]);

  const useLive = liveSeries.length >= 2;

  useEffect(() => {
    if (useLive || reduced) return;
    const id = window.setInterval(() => setMockTick((t) => t + 1), 2_200);
    return () => window.clearInterval(id);
  }, [useLive, reduced]);

  const series = useLive ? liveSeries : lobbySparklineSeries(game, limit, mockTick);
  const points = polylineFromSeries(series, width, height);

  if (!points) {
    return (
      <svg width={width} height={height} aria-hidden className="opacity-40">
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke={accent}
          strokeWidth={1.2}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} aria-hidden style={{ overflow: "visible" }}>
      <polyline
        points={points}
        fill="none"
        stroke={accent}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={reduced ? undefined : { filter: `drop-shadow(0 0 4px ${accent})` }}
      />
    </svg>
  );
}

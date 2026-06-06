/**
 * Game lobby FOMO display — drifting live counts + sparkline seed data.
 * Display-only; not money truth (mocks / liveBetsStore activity).
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { liveBetsStore, type LiveGame } from "@/shared/livefeed/LiveBetsStore";
import { randomMaskedNick } from "@/shared/livefeed/nicknames";

const OPEN_LOBBY_GAMES: LiveGame[] = [
  "crash",
  "dice",
  "plinko",
  "mines",
  "limbo",
  "wheel",
];

function hashGame(game: LiveGame): number {
  return game.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

/** Deterministic mock multipliers — used until live feed has enough wins. */
export function lobbySparklineSeries(game: LiveGame, points = 24, tick = 0): number[] {
  let seed = hashGame(game) + tick * 997;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
    const span = game === "crash" || game === "limbo" ? 14 : 6;
    out.push(+(1.05 + ((seed % 1000) / 1000) * span).toFixed(2));
  }
  return out;
}

export function polylineFromSeries(series: number[], width: number, height: number): string {
  if (series.length < 2) return "";
  const max = Math.max(...series, 2);
  const min = Math.min(...series, 1);
  const span = Math.max(0.01, max - min);
  const step = width / (series.length - 1);
  return series
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Seed settled wins so lobby sparklines render on first paint. */
export function seedLobbySparklines(): void {
  const snap = liveBetsStore.getSnapshot();
  for (const game of OPEN_LOBBY_GAMES) {
    const wins = snap.filter((b) => b.game === game && b.multiplier != null && b.multiplier > 0)
      .length;
    const need = Math.max(0, 24 - wins);
    for (let i = 0; i < need; i++) {
      const mult = lobbySparklineSeries(game, 1, i + wins)[0] ?? 1.5;
      const amount = 10 + (i % 7) * 5;
      liveBetsStore.push({
        user: randomMaskedNick(),
        game,
        amount,
        multiplier: mult,
        profit: +(amount * (mult - 1)).toFixed(2),
        status: game === "crash" ? "cashout" : "win",
        mode: "demo",
        ts: Date.now() - (need - i) * 1500,
      });
    }
  }
}

/** Mock base + store activity + random walk → Stake-like live player count. */
export function useGameLobbyLiveCount(game: LiveGame, base: number): number {
  const snap = useSyncExternalStore(
    liveBetsStore.subscribe,
    liveBetsStore.getSnapshot,
    liveBetsStore.getSnapshot,
  );
  const [offset, setOffset] = useState(0);

  const recentActivity = useMemo(() => {
    const cutoff = Date.now() - 90_000;
    return snap.filter((b) => b.game === game && b.ts >= cutoff).length;
  }, [snap, game]);

  useEffect(() => {
    const id = window.setInterval(
      () => {
        setOffset((o) => {
          const delta = Math.round((Math.random() - 0.4) * 7);
          return Math.max(-35, Math.min(35, o + delta));
        });
      },
      800 + Math.random() * 600,
    );
    return () => window.clearInterval(id);
  }, []);

  return Math.max(8, base + recentActivity * 2 + offset);
}

import type { UTCTimestamp } from "lightweight-charts";
import type { CandleRow } from "./schemas";

export function toChartCandles(rows: CandleRow[]) {
  return [...rows]
    .sort((a, b) => a.time - b.time)
    .map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
}

export function buildFallbackCandles(symbol: string, count = 48) {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 40_000 + (seed % 5_000);
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: count }, (_, i) => {
    const t = now - (count - 1 - i) * 300;
    const open = base + Math.sin(i / 3 + seed) * 120 + i * 2;
    const close = open + Math.cos(i / 2 + seed) * 80;
    const high = Math.max(open, close) + 40;
    const low = Math.min(open, close) - 40;
    return { time: t as UTCTimestamp, open, high, low, close };
  });
}

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";

function buildDemoCandles(symbol: string) {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 40_000 + (seed % 5_000);
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 48 }, (_, i) => {
    const t = now - (47 - i) * 300;
    const open = base + Math.sin(i / 3 + seed) * 120 + i * 2;
    const close = open + Math.cos(i / 2 + seed) * 80;
    const high = Math.max(open, close) + 40;
    const low = Math.min(open, close) - 40;
    return { time: t as UTCTimestamp, open, high, low, close };
  });
}

interface ExchangeChartProps {
  symbol: string;
  className?: string;
}

export function ExchangeChart({ symbol, className }: ExchangeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "oklch(0.72 0.02 280)",
      },
      grid: {
        vertLines: { color: "oklch(1 0 0 / 0.06)" },
        horzLines: { color: "oklch(1 0 0 / 0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { vertLine: { labelVisible: false } },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "oklch(0.72 0.17 155)",
      downColor: "oklch(0.65 0.2 25)",
      borderVisible: false,
      wickUpColor: "oklch(0.72 0.17 155)",
      wickDownColor: "oklch(0.65 0.2 25)",
    });
    series.setData(buildDemoCandles(symbol));

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label={`${symbol} candlestick chart`}
    />
  );
}

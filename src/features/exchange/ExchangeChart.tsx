import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, createChart, type IChartApi } from "lightweight-charts";
import { useMarketCandles } from "@/shared/trading/useMarketCandles";

interface ExchangeChartProps {
  symbol: string;
  className?: string;
}

export function ExchangeChart({ symbol, className }: ExchangeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addSeries"]> | null>(null);
  const { candles, isLive } = useMarketCandles(symbol);

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
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol]);

  useEffect(() => {
    seriesRef.current?.setData(candles);
  }, [candles]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={className}
        role="img"
        aria-label={`${symbol} candlestick chart`}
      />
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
        {isLive ? "Supabase" : "fallback"}
      </span>
    </div>
  );
}

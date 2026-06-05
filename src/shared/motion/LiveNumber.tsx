/**
 * LiveNumber — naturally drifts ±amplitudeRatio around `base`.
 *
 * Subscribes to the shared `liveTickScheduler` so all live numbers on screen
 * share a single rAF loop (no per-instance setTimeout). Visual interpolation
 * is handled by `CountUp`, which writes directly into the DOM without
 * re-rendering React. This is the configuration that keeps the landing
 * page smooth even with many live counters.
 */
import { useEffect, useRef, useState } from "react";
import { CountUp } from "./CountUp";
import { subscribeLiveTick } from "./liveTickScheduler";

interface Props {
  base: number;
  /** ±band ratio (0.002 = ±0.2%) */
  amplitudeRatio?: number;
  /** Upward bias (0.5 = neutral, 0.6 = 60% up) */
  bias?: number;
  /** Mean tick interval in ms */
  intervalMs?: number;
  className?: string;
  format?: (n: number) => string;
  /** CountUp interpolation duration */
  duration?: number;
}

function gaussian() {
  const u = Math.random() || 1e-9;
  const v = Math.random() || 1e-9;
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-2, Math.min(2, g));
}

export function LiveNumber({
  base,
  amplitudeRatio = 0.004,
  bias = 0.5,
  intervalMs = 3500,
  className,
  format,
  duration = 1400,
}: Props) {
  const [value, setValue] = useState(base);
  const baseRef = useRef(base);
  const valueRef = useRef(base);

  useEffect(() => {
    baseRef.current = base;
    valueRef.current = base;
    setValue(base);
  }, [base]);

  useEffect(() => {
    return subscribeLiveTick(() => {
      const b = baseRef.current;
      const prev = valueRef.current;
      const dir = Math.random() < bias ? 1 : -1;
      const stepRatio = 0.0002 + Math.abs(gaussian()) * 0.0006;
      const delta = b * stepRatio * dir;
      let next = prev + delta;
      const lo = b * (1 - amplitudeRatio);
      const hi = b * (1 + amplitudeRatio);
      if (next < lo) next = prev + Math.abs(delta);
      if (next > hi) next = prev - Math.abs(delta);
      valueRef.current = next;
      setValue(next);
    }, intervalMs);
  }, [amplitudeRatio, bias, intervalMs]);

  return <CountUp value={value} duration={duration} className={className} format={format} />;
}

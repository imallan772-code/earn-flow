/**
 * LiveNumber — 자연스럽게 ↑↓ 미세 변동하는 카운터.
 *
 * - base 기준 ±amplitudeRatio 밴드 안에서만 움직임 (너무 튀지 않게).
 * - 한 번에 0.02~0.15% 정도 변화 (가우시안 jitter).
 * - bias: 0.5면 양방향, 0.6이면 60% 확률로 상승.
 * - prefers-reduced-motion 또는 document.hidden일 때 정지.
 * - CountUp으로 보간하여 부드럽게 흐름.
 */
import { useEffect, useRef, useState } from "react";
import { CountUp } from "./CountUp";

interface Props {
  base: number;
  /** ±밴드 비율 (0.002 = ±0.2%) */
  amplitudeRatio?: number;
  /** 상승 확률 (0.5 = 중립) */
  bias?: number;
  /** 평균 변동 주기 ms */
  intervalMs?: number;
  className?: string;
  format?: (n: number) => string;
  /** CountUp 보간 duration */
  duration?: number;
}

function gaussian() {
  // Box-Muller, clamped to [-2, 2]
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

  useEffect(() => {
    baseRef.current = base;
    setValue(base);
  }, [base]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!document.hidden) {
        setValue((prev) => {
          const b = baseRef.current;
          const dir = Math.random() < bias ? 1 : -1;
          // step: 0.02% ~ 0.15% of base
          const stepRatio = (0.0002 + Math.abs(gaussian()) * 0.0006);
          const delta = b * stepRatio * dir;
          let next = prev + delta;
          // soft clamp into ±amplitudeRatio band; gently pull toward base if outside
          const lo = b * (1 - amplitudeRatio);
          const hi = b * (1 + amplitudeRatio);
          if (next < lo) next = prev + Math.abs(delta);
          if (next > hi) next = prev - Math.abs(delta);
          return next;
        });
      }
      const jitter = intervalMs * (0.6 + Math.random() * 0.8);
      timer = setTimeout(tick, jitter);
    };
    timer = setTimeout(tick, intervalMs);
    return () => clearTimeout(timer);
  }, [amplitudeRatio, bias, intervalMs]);

  return (
    <CountUp
      value={value}
      duration={duration}
      className={className}
      format={format}
    />
  );
}

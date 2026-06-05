/**
 * CountUp — smoothly interpolates a numeric value to a target.
 *
 * Performance: uses a single ref + RAF to write directly into the DOM
 * (textContent). Avoids per-frame React re-renders, which were a major
 * source of UI jank when many CountUp / LiveNumber instances were live.
 */
import { useEffect, useLayoutEffect, useRef } from "react";

interface Props {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}

const defaultFmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

export function CountUp({ value, duration = 900, className, format = defaultFmt }: Props) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const fromRef = useRef(value);
  const fmtRef = useRef(format);

  // Keep latest formatter without retriggering effects.
  fmtRef.current = format;

  // Set initial text synchronously to avoid an empty paint.
  useLayoutEffect(() => {
    if (spanRef.current) {
      spanRef.current.textContent = fmtRef.current(fromRef.current);
    }
  }, []);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      if (spanRef.current) spanRef.current.textContent = fmtRef.current(to);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      if (spanRef.current) spanRef.current.textContent = fmtRef.current(to);
      fromRef.current = to;
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = from + (to - from) * eased;
      if (spanRef.current) spanRef.current.textContent = fmtRef.current(cur);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span ref={spanRef} className={className} style={{ fontVariantNumeric: "tabular-nums" }} />
  );
}

/**
 * WheelDisplay — Design B "Neon Pulse Casino" 휠 디스플레이.
 *
 * 끝판왕 정책 (ROUND J v1.2)
 *  - SVG only (no Canvas/WebGL). framer-motion `LazyMotion`(root) + `m.svg` rotate.
 *  - 풀 N(10/20/30) 세그먼트 + 이중 베젤 중앙 허브 + 골드 포인터 + ambient radial glow.
 *  - 0× vignette + idle 세그먼트 배수 라벨 (audit #3).
 *  - reduced-motion ON → 회전 즉시, 펄스 OFF.
 *  - 색/글래스 SSOT: @theme tokens only. raw tailwind palette 금지.
 *  - styles.css 미접촉: idle pulse는 기존 `animate-phon-pulse` 재사용.
 */
import { memo, useEffect, useMemo } from "react";
import { animate, m, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useTilt } from "@/shared/hooks/useTilt";
import { RewardBurst } from "@/shared/motion/RewardBurst";
import {
  expectedMultiplier,
  getSegments,
  type WheelRisk,
  type WheelSegments,
} from "@/shared/games/wheel/WheelEngine";
import { cn } from "@/lib/utils";

const FULL_TURNS = 5; // 3.2s ease-out 회전
const WHEEL_SIZE = 280;
const PAD = 6;

interface Props {
  risk: WheelRisk;
  segments: WheelSegments;
  phase: "idle" | "rolling" | "settled";
  resultIndex: number | null;
  resultMultiplier: number | null;
  jackpotTrigger: number;
}

/** 위험도 → @theme 토큰. risk 색이 active 세그먼트(>0×)에 매핑. */
function riskColor(risk: WheelRisk): string {
  if (risk === "low") return "var(--color-cyan)";
  if (risk === "medium") return "var(--color-gold)";
  return "var(--color-rose)";
}

/** 0× vignette. @theme tokens only. */
const ZERO_COLOR = "color-mix(in oklab, var(--color-muted) 60%, var(--color-bg-0))";

interface SegPath {
  d: string;
  /** 라벨 좌표 (호 중간, 반지름 중앙). */
  lx: number;
  ly: number;
}

function buildPaths(count: number): SegPath[] {
  const cx = WHEEL_SIZE / 2;
  const cy = WHEEL_SIZE / 2;
  const rOuter = WHEEL_SIZE / 2 - PAD;
  const rInner = rOuter * 0.42; // 중앙 허브와 시각 균형
  const per = (Math.PI * 2) / count;
  const out: SegPath[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = -Math.PI / 2 + i * per;
    const a1 = a0 + per;
    const x0o = cx + rOuter * Math.cos(a0);
    const y0o = cy + rOuter * Math.sin(a0);
    const x1o = cx + rOuter * Math.cos(a1);
    const y1o = cy + rOuter * Math.sin(a1);
    const x1i = cx + rInner * Math.cos(a1);
    const y1i = cy + rInner * Math.sin(a1);
    const x0i = cx + rInner * Math.cos(a0);
    const y0i = cy + rInner * Math.sin(a0);
    const large = per > Math.PI ? 1 : 0;
    const d = [
      `M ${x0o.toFixed(3)} ${y0o.toFixed(3)}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o.toFixed(3)} ${y1o.toFixed(3)}`,
      `L ${x1i.toFixed(3)} ${y1i.toFixed(3)}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${x0i.toFixed(3)} ${y0i.toFixed(3)}`,
      "Z",
    ].join(" ");
    const aMid = a0 + per / 2;
    const rLabel = (rOuter + rInner) / 2;
    const lx = cx + rLabel * Math.cos(aMid);
    const ly = cy + rLabel * Math.sin(aMid);
    out.push({ d, lx, ly });
  }
  return out;
}

export const WheelDisplay = memo(function WheelDisplay({
  risk,
  segments,
  phase,
  resultIndex,
  resultMultiplier,
  jackpotTrigger,
}: Props) {
  const reduced = useReducedMotion();
  const tiltRef = useTilt<HTMLDivElement>(6);

  const segArr = useMemo(() => getSegments(risk, segments), [risk, segments]);
  const paths = useMemo(() => buildPaths(segments), [segments]);
  const avgMult = useMemo(() => expectedMultiplier(risk, segments), [risk, segments]);
  const color = riskColor(risk);

  // Rotation: 결과 인덱스 중앙이 12시 포인터로 정렬.
  const perDeg = 360 / segments;
  const targetRot =
    resultIndex != null ? FULL_TURNS * 360 - (resultIndex * perDeg + perDeg / 2) : 0;

  // Count-up 카운터 (Limbo 패턴).
  const mv = useMotionValue(avgMult);
  const text = useTransform(mv, (v) => `${v.toFixed(2)}x`);
  useEffect(() => {
    if (phase === "rolling") return;
    if (resultMultiplier == null) {
      mv.set(avgMult);
      return;
    }
    if (reduced) {
      mv.set(resultMultiplier);
      return;
    }
    const controls = animate(mv, resultMultiplier, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [phase, resultMultiplier, avgMult, reduced, mv]);

  // 라벨 폰트 사이즈 (10→11px / 20→9px / 30→7px).
  const labelSize = segments === 10 ? 11 : segments === 20 ? 9 : 7;

  const isJackpot =
    resultMultiplier != null && resultMultiplier >= 9.0 && phase !== "rolling";

  // 결과 색
  const counterColor =
    resultMultiplier != null
      ? resultMultiplier > 0
        ? color
        : "var(--color-muted)"
      : "var(--color-foreground)";

  return (
    <div
      ref={tiltRef}
      className="glass-2 relative aspect-square w-full overflow-hidden rounded-[2.5rem] p-4 will-change-transform"
      style={{
        background: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${color} 12%, transparent) 0%, transparent 65%), color-mix(in oklab, var(--color-surface-hi) 70%, var(--color-bg-0))`,
      }}
    >
      {/* 포인터(12시) — 골드 헤일로 + 테이퍼 */}
      <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2" aria-hidden>
        <div
          className="h-4 w-4 rounded-full bg-(--color-gold) shadow-glow-gold ring-2 ring-(--color-bg-0)"
          style={{
            transform: phase === "settled" ? "scale(1.25)" : "scale(1)",
            transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <div
          className="mx-auto -mt-0.5 h-4 w-[3px]"
          style={{
            background: "linear-gradient(to bottom, var(--color-gold), transparent)",
          }}
        />
      </div>

      <div
        className="relative mx-auto"
        style={{ width: "100%", maxWidth: WHEEL_SIZE, aspectRatio: "1 / 1" }}
      >
        <m.svg
          viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
          width="100%"
          height="100%"
          animate={{ rotate: targetRot }}
          transition={
            reduced
              ? { duration: 0 }
              : phase === "rolling"
                ? { duration: 3.2, ease: [0.16, 1, 0.3, 1] }
                : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
          }
          style={{ transformOrigin: "50% 50%" }}
        >
          {paths.map((p, i) => {
            const mult = segArr[i];
            const isZero = mult === 0;
            const isResult = phase === "settled" && resultIndex === i;
            const baseOpacity = isZero ? 0.55 : 0.92;
            const fill = isZero ? ZERO_COLOR : color;
            // Idle 펄스: active(>0) 세그먼트만, reduced-motion OFF, phase=idle.
            const pulseIdle = phase === "idle" && !isZero && !reduced;
            return (
              <g key={i}>
                <path
                  d={p.d}
                  fill={fill}
                  fillOpacity={baseOpacity}
                  stroke="var(--color-bg-0)"
                  strokeWidth={1.2}
                  className={pulseIdle ? "animate-phon-pulse" : undefined}
                  style={isResult ? { filter: `drop-shadow(0 0 14px ${color})` } : undefined}
                />
                {phase === "idle" && (
                  <text
                    x={p.lx}
                    y={p.ly}
                    fontSize={labelSize}
                    fontWeight={800}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isZero ? "var(--color-muted)" : "var(--color-bg-0)"}
                    style={{ pointerEvents: "none", letterSpacing: "-0.02em" }}
                  >
                    {isZero ? "0×" : `${mult}×`}
                  </text>
                )}
              </g>
            );
          })}
        </m.svg>

        {/* 중앙 허브 — 이중 베젤 + inset shadow */}
        <div
          className={cn(
            "glass-3 pointer-events-none absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full",
          )}
          style={{
            width: "36%",
            height: "36%",
            border: "4px solid color-mix(in oklab, var(--color-gold) 30%, transparent)",
            boxShadow:
              "inset 0 0 24px color-mix(in oklab, var(--color-bg-0) 70%, transparent), 0 0 24px color-mix(in oklab, var(--color-bg-0) 50%, transparent)",
          }}
        >
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
              결과
            </div>
            {phase === "rolling" ? (
              <m.div
                key="rolling"
                animate={{ opacity: reduced ? 1 : [0.6, 1, 0.6] }}
                transition={{ duration: 0.8, repeat: reduced ? 0 : Infinity }}
                className="font-numeric mt-0.5 text-3xl font-black tabular-nums text-(--color-cyan)"
              >
                ···
              </m.div>
            ) : (
              <m.span
                className="font-numeric mt-0.5 block text-3xl font-black tabular-nums"
                style={{ color: counterColor }}
              >
                {text}
              </m.span>
            )}
            <div className="mx-auto mt-1 h-0.5 w-10 animate-phon-pulse rounded-full bg-(--color-gold)" />
          </div>
        </div>

        {/* Jackpot 폭죽 */}
        {isJackpot && <RewardBurst trigger={jackpotTrigger} count={14} />}
      </div>
    </div>
  );
});

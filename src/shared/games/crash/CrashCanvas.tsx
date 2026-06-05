/**
 * CrashCanvas — Stake-grade curve graph with cosmic gradient, particles,
 * grid labels, and a betting-phase countdown ring.
 *
 * Single RAF rule: subscribe to the shared tick loop, never call rAF directly.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { sharedTickLoop } from "@/shared/games/engine/tickLoop";
import { multiplierAt, type Phase, BETTING_MS } from "./CrashEngine";

interface Props {
  phase: Phase;
  startedAt: number;
  crashPoint: number;
  bettingMsLeft?: number;
}

const GRID_X_LABELS = [1, 1.5, 2, 3, 5, 10];

export function CrashCanvas({ phase, startedAt, crashPoint, bettingMsLeft }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ phase, startedAt, crashPoint, bettingMsLeft });
  stateRef.current = { phase, startedAt, crashPoint, bettingMsLeft };
  const reduced = useReducedMotion() ?? false;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // particle trail — positions relative to curve head, drifting up
  const particlesRef = useRef<Array<{ t0: number; ox: number; oy: number }>>([]);

  useEffect(() => {
    const loop = sharedTickLoop();
    const unsub = loop.subscribe(() => draw());
    return () => unsub();
  }, []);

  function draw() {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = cnv.clientWidth;
    const cssH = cnv.clientHeight;
    if (cnv.width !== cssW * dpr || cnv.height !== cssH * dpr) {
      cnv.width = cssW * dpr;
      cnv.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const { phase: ph, startedAt: sa, crashPoint: cp, bettingMsLeft: bml } = stateRef.current;
    const elapsed = ph === "running" || ph === "crashed" ? performance.now() - sa : 0;
    const liveM = ph === "crashed" ? cp : multiplierAt(elapsed);

    // background radial wash
    const wash = ctx.createRadialGradient(cssW / 2, cssH * 0.85, 0, cssW / 2, cssH * 0.85, cssH);
    if (ph === "crashed") {
      // ROUND L-1: rose wash 강화. animate-crash-shake와 동기.
      wash.addColorStop(0, "oklch(0.68 0.24 25 / 0.28)");
      wash.addColorStop(0.55, "oklch(0.55 0.20 18 / 0.12)");
      wash.addColorStop(1, "oklch(0.18 0.05 282 / 0)");
    } else {
      wash.addColorStop(0, "oklch(0.85 0.18 200 / 0.14)");
      wash.addColorStop(1, "oklch(0.18 0.05 282 / 0)");
    }
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, cssW, cssH);

    // grid
    ctx.strokeStyle = "oklch(1 0 0 / 0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = (cssH / 6) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      const x = (cssW / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }

    // map elapsed → x, multiplier → y
    const xMax = Math.max(elapsed, 8000);
    const yMax = Math.max(liveM, 2);
    const toX = (t: number) => (t / xMax) * cssW * 0.92 + cssW * 0.04;
    const toY = (m: number) => cssH - ((m - 1) / (yMax - 1)) * cssH * 0.82 - cssH * 0.06;

    // y-axis multiplier labels (1x .. yMax)
    ctx.font = "600 9px JetBrains Mono, monospace";
    ctx.fillStyle = "oklch(0.50 0.04 282)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const m of GRID_X_LABELS) {
      if (m > yMax) break;
      const y = toY(m);
      if (y < 8 || y > cssH - 8) continue;
      ctx.fillText(`${m}x`, 4, y - 6);
      ctx.strokeStyle = "oklch(1 0 0 / 0.04)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }

    const isLive = ph === "running" || ph === "crashed";
    const accent = ph === "crashed" ? "oklch(0.68 0.22 25)" : "oklch(0.85 0.18 200)";

    if (isLive) {
      // filled area
      const grad = ctx.createLinearGradient(0, 0, 0, cssH);
      if (ph === "crashed") {
        grad.addColorStop(0, "oklch(0.68 0.22 25 / 0.28)");
        grad.addColorStop(1, "oklch(0.68 0.22 25 / 0)");
      } else {
        grad.addColorStop(0, "oklch(0.85 0.18 200 / 0.34)");
        grad.addColorStop(0.6, "oklch(0.70 0.24 300 / 0.18)");
        grad.addColorStop(1, "oklch(0.85 0.18 200 / 0)");
      }
      ctx.fillStyle = grad;

      const steps = 48;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(1));
      for (let i = 0; i <= steps; i++) {
        const t = (elapsed * i) / steps;
        ctx.lineTo(toX(t), toY(Math.min(multiplierAt(t), cp)));
      }
      ctx.lineTo(toX(elapsed), cssH);
      ctx.lineTo(toX(0), cssH);
      ctx.closePath();
      ctx.fill();

      // stroke
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(1));
      for (let i = 0; i <= steps; i++) {
        const t = (elapsed * i) / steps;
        ctx.lineTo(toX(t), toY(Math.min(multiplierAt(t), cp)));
      }
      ctx.stroke();
      const hx = toX(elapsed);
      const hy = toY(liveM);
      // glow ring under the head — denser visual weight
      if (!reducedRef.current) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 18;
      }
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // particles — spawn while running. reduced-motion → off.
      const reducedM = reducedRef.current;
      const maxParticles = reducedM ? 0 : 22;
      const spawnChance = reducedM ? 0 : 0.55;
      const now = performance.now();
      if (
        ph === "running" &&
        particlesRef.current.length < maxParticles &&
        Math.random() < spawnChance
      ) {
        particlesRef.current.push({
          t0: now,
          ox: hx + (Math.random() - 0.5) * 20,
          oy: hy + (Math.random() - 0.5) * 8,
        });
      }
      particlesRef.current = particlesRef.current.filter((p) => now - p.t0 < 1400);
      for (const p of particlesRef.current) {
        const age = (now - p.t0) / 1400;
        const a = 1 - age;
        // dual-tone trail: cyan core + purple outer halo
        ctx.fillStyle = `oklch(0.78 0.22 295 / ${(a * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.ox, p.oy - age * 36, 3.5 + a * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `oklch(0.88 0.18 200 / ${(a * 0.85).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.ox, p.oy - age * 36, 1.8 + a * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }


    // text overlays
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (ph === "betting") {
      // countdown ring
      const ms = bml ?? 0;
      const left = Math.max(0, ms);
      const pct = 1 - left / BETTING_MS;
      const cx = cssW / 2;
      const cy = cssH / 2;
      const r = Math.min(cssW, cssH) * 0.22;

      ctx.lineWidth = 6;
      ctx.strokeStyle = "oklch(1 0 0 / 0.08)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "oklch(0.85 0.18 200)";
      ctx.shadowColor = "oklch(0.85 0.18 200)";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "oklch(0.68 0.03 282)";
      ctx.font = "600 11px Pretendard, system-ui";
      ctx.fillText("다음 라운드", cx, cy - 20);
      ctx.fillStyle = "oklch(0.98 0.01 280)";
      ctx.font = "800 44px JetBrains Mono, monospace";
      ctx.fillText(`${Math.ceil(left / 1000)}`, cx, cy + 14);
      ctx.fillStyle = "oklch(0.68 0.03 282)";
      ctx.font = "600 10px Pretendard, system-ui";
      ctx.fillText("sec", cx, cy + 40);
    } else if (ph === "cooldown") {
      ctx.fillStyle = "oklch(0.68 0.22 25)";
      ctx.font = "800 28px JetBrains Mono, monospace";
      ctx.fillText("BUSTED", cssW / 2, cssH / 2 - 16);
      ctx.font = "800 42px JetBrains Mono, monospace";
      ctx.fillText(`${cp.toFixed(2)}x`, cssW / 2, cssH / 2 + 22);
    } else if (ph === "crashed") {
      ctx.fillStyle = "oklch(0.68 0.22 25)";
      ctx.font = "800 56px JetBrains Mono, monospace";
      ctx.fillText(`${liveM.toFixed(2)}x`, cssW / 2, cssH / 2);
    } else {
      ctx.fillStyle = "oklch(0.98 0.01 280)";
      ctx.font = "800 64px JetBrains Mono, monospace";
      ctx.shadowColor = "oklch(0.85 0.18 200 / 0.5)";
      ctx.shadowBlur = 18;
      ctx.fillText(`${liveM.toFixed(2)}x`, cssW / 2, cssH / 2);
      ctx.shadowBlur = 0;
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full rounded-2xl"
      style={{ background: "var(--color-bg-1)" }}
    />
  );
}

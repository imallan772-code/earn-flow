/**
 * CrashCanvas — Stake.com style curve graph.
 *
 * Subscribes to the shared tick loop. Single RAF rule:
 * never call requestAnimationFrame here directly.
 */
import { useEffect, useRef } from "react";
import { sharedTickLoop } from "@/shared/games/engine/tickLoop";
import { multiplierAt, type Phase } from "./CrashEngine";

interface Props {
  phase: Phase;
  startedAt: number;
  crashPoint: number;
  /** ms remaining in betting phase, only used when phase === "betting". */
  bettingMsLeft?: number;
}

export function CrashCanvas({ phase, startedAt, crashPoint, bettingMsLeft }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ phase, startedAt, crashPoint });
  stateRef.current = { phase, startedAt, crashPoint };

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

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
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

    const { phase: ph, startedAt: sa, crashPoint: cp } = stateRef.current;
    const elapsed = ph === "running" || ph === "crashed" ? performance.now() - sa : 0;
    const liveM = ph === "crashed" ? cp : multiplierAt(elapsed);

    // map elapsed (0 .. max(elapsed, 8000)) to x; multiplier (1 .. max(liveM, 2)) to y
    const xMax = Math.max(elapsed, 8000);
    const yMax = Math.max(liveM, 2);
    const toX = (t: number) => (t / xMax) * cssW * 0.92 + cssW * 0.04;
    const toY = (m: number) =>
      cssH - ((m - 1) / (yMax - 1)) * cssH * 0.82 - cssH * 0.06;

    // curve
    const accent =
      ph === "crashed"
        ? "oklch(0.68 0.22 25)"
        : "oklch(0.85 0.18 200)";

    // fill under curve
    const grad = ctx.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, "oklch(0.85 0.18 200 / 0.30)");
    grad.addColorStop(1, "oklch(0.85 0.18 200 / 0)");
    ctx.fillStyle =
      ph === "crashed"
        ? "oklch(0.68 0.22 25 / 0.18)"
        : (grad as unknown as CanvasGradient);

    if (ph === "running" || ph === "crashed") {
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(1));
      const steps = 64;
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
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(1));
      for (let i = 0; i <= steps; i++) {
        const t = (elapsed * i) / steps;
        ctx.lineTo(toX(t), toY(Math.min(multiplierAt(t), cp)));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // head dot
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(toX(elapsed), toY(liveM), 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // multiplier text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (ph === "betting") {
      const ms = bettingMsLeft ?? 0;
      const s = Math.max(0, Math.ceil(ms / 1000));
      ctx.fillStyle = "oklch(0.68 0.03 282)";
      ctx.font = "600 14px Pretendard, system-ui";
      ctx.fillText("다음 라운드", cssW / 2, cssH / 2 - 28);
      ctx.fillStyle = "oklch(0.98 0.01 280)";
      ctx.font = "800 56px JetBrains Mono, monospace";
      ctx.fillText(`${s}s`, cssW / 2, cssH / 2 + 10);
    } else if (ph === "cooldown") {
      ctx.fillStyle = "oklch(0.68 0.22 25)";
      ctx.font = "800 44px JetBrains Mono, monospace";
      ctx.fillText(`CRASHED @ ${cp.toFixed(2)}x`, cssW / 2, cssH / 2);
    } else {
      ctx.fillStyle = ph === "crashed" ? "oklch(0.68 0.22 25)" : "oklch(0.98 0.01 280)";
      ctx.font = "800 64px JetBrains Mono, monospace";
      ctx.fillText(`${liveM.toFixed(2)}x`, cssW / 2, cssH / 2);
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

/**
 * PlinkoRenderer — Canvas 2D high-performance renderer.
 *
 * 역할: PlinkoEngine 결과를 시각화. 순수 Canvas 클래스, React/DOM 이벤트 0.
 * 3-Layer (static / dynamic / fx) + Dirty Rendering + 3-tier Quality + Particle Pool.
 *
 * TODO: Real money 모드 — WebGL2 백엔드로 교체 시 이 public API(setQuality/setRows/
 *       setRisk/resize/playDrop/stop/destroy)를 그대로 유지. 호출부 무수정.
 */
import {
  MULTIPLIERS,
  SLOT_COUNT,
  type PlinkoDropResult,
  type PlinkoEngine,
  type RiskLevel,
  type RowCount,
} from "./PlinkoEngine";

export type QualityLevel = "low" | "medium" | "high";

export interface PlinkoRendererOptions {
  quality?: QualityLevel;
  rows?: RowCount;
  risk?: RiskLevel;
}

interface Sample {
  x: number;
  y: number;
  vy: number;
  progress: number;
  pegRow: number | null;
}

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface PopAnim {
  active: boolean;
  slot: number;
  start: number;
  multiplier: number;
}

const DROP_DURATION_MS = 1200;
const POP_DURATION_MS = 700;
const POOL_SIZE: Record<QualityLevel, number> = { low: 0, medium: 24, high: 96 };
const TRAIL_SAMPLES: Record<QualityLevel, number> = { low: 0, medium: 8, high: 24 };

/** Per-(risk, rows) max multiplier — auto-derived from engine table. */
const MAX_MULT: Record<RiskLevel, Record<RowCount, number>> = (() => {
  const out = {
    low: { 8: 1, 12: 1, 16: 1 },
    medium: { 8: 1, 12: 1, 16: 1 },
    high: { 8: 1, 12: 1, 16: 1 },
  } as Record<RiskLevel, Record<RowCount, number>>;
  (["low", "medium", "high"] as const).forEach((r) => {
    ([8, 12, 16] as const).forEach((n) => {
      const table = MULTIPLIERS[r]?.[n];
      out[r][n] = table && table.length ? Math.max(...table) : 1;
    });
  });
  return out;
})();

export class PlinkoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private staticCanvas: HTMLCanvasElement;
  private staticCtx: CanvasRenderingContext2D;

  private quality: QualityLevel;
  private rows: RowCount;
  private risk: RiskLevel;

  private cssW = 0;
  private cssH = 0;
  private dpr = 1;

  private rafId: number | null = null;
  private staticDirty = true;

  private samples: Sample[] = [];
  private playStart = 0;
  private cursor = 0;
  private onLand?: (slot: number, multiplier: number) => void;
  private landedFor = -1;

  private particles: Particle[] = [];
  private pop: PopAnim = { active: false, slot: -1, start: 0, multiplier: 0 };

  private pendingQuality: QualityLevel | null = null;
  private destroyed = false;

  // peg / slot layout (computed in resize/static rebuild)
  private pegRadius = 4;
  private ballRadius = 6;
  private padX = 12;
  private padTop = 16;
  private slotH = 40;

  constructor(canvas: HTMLCanvasElement, opts: PlinkoRendererOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("PlinkoRenderer: 2D context unavailable");
    this.ctx = ctx;

    this.staticCanvas = document.createElement("canvas");
    const sctx = this.staticCanvas.getContext("2d", { alpha: true });
    if (!sctx) throw new Error("PlinkoRenderer: offscreen 2D context unavailable");
    this.staticCtx = sctx;

    this.quality = opts.quality ?? "medium";
    this.rows = opts.rows ?? 16;
    this.risk = opts.risk ?? "medium";
    this.initPool();
  }

  // ---------------------------------------------------------------- public API

  setQuality(q: QualityLevel): void {
    if (q === this.quality && this.pendingQuality === null) return;
    if (this.isAnimating()) {
      this.pendingQuality = q;
      return;
    }
    this.applyQuality(q);
  }

  setRows(rows: RowCount): void {
    if (rows === this.rows) return;
    this.rows = rows;
    this.staticDirty = true;
    this.requestDraw();
  }

  setRisk(risk: RiskLevel): void {
    if (risk === this.risk) return;
    this.risk = risk;
    this.staticDirty = true;
    this.requestDraw();
  }

  resize(width: number, height: number, dpr: number): void {
    if (width < 1 || height < 1) return;
    if (this.cssW === width && this.cssH === height && this.dpr === dpr) return;
    this.cssW = width;
    this.cssH = height;
    this.dpr = dpr;
    const bw = Math.round(width * dpr);
    const bh = Math.round(height * dpr);
    this.canvas.width = bw;
    this.canvas.height = bh;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.staticCanvas.width = bw;
    this.staticCanvas.height = bh;
    this.staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.staticDirty = true;
    this.requestDraw();
  }

  playDrop(
    result: PlinkoDropResult,
    engine: PlinkoEngine,
    onLand?: (slot: number, multiplier: number) => void,
  ): void {
    // Atomic reset: cancel any in-flight frame BEFORE mutating samples to
    // prevent a queued frame from racing on partially-rebuilt data.
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.samples.length = 0;
    this.cursor = 0;
    this.landedFor = -1;
    this.pop.active = false;
    for (const p of this.particles) p.alive = false;

    engine.simulatePhysics(result, (x, y, vy, progress) => {
      const pegRow = this.derivePegRow(progress, result.totalRows);
      this.samples.push({ x, y, vy, progress, pegRow });
    });
    if (this.samples.length === 0) return;

    this.playStart = performance.now();
    this.onLand = onLand;

    // store result data on pop for slot/mult emit
    this.pop.slot = result.finalSlot;
    this.pop.multiplier = result.multiplier;

    this.requestDraw();
  }

  stop(): void {
    this.samples.length = 0;
    this.cursor = 0;
    this.pop.active = false;
    for (const p of this.particles) p.alive = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
  }

  // ---------------------------------------------------------------- internals

  private initPool(): void {
    const size = POOL_SIZE[this.quality];
    this.particles = new Array(size).fill(null).map(() => ({
      alive: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      color: "#fff",
    }));
  }

  private applyQuality(q: QualityLevel): void {
    this.quality = q;
    this.pendingQuality = null;
    this.initPool();
    this.staticDirty = true;
    this.requestDraw();
  }

  private derivePegRow(progress: number, rows: RowCount): number | null {
    // progress ∈ [row/(rows+1), (row+1)/(rows+1)) → at the END of each row, ball just hit peg row
    // we mark sample as pegRow=row when progress crosses (row+1)/(rows+1) boundary (last substep of row)
    const t = progress * (rows + 1);
    const row = Math.floor(t);
    const frac = t - row;
    // last 1/14 of each row segment → peg-hit window
    if (row < rows && frac >= 13 / 14) return row;
    return null;
  }

  private isAnimating(): boolean {
    const playing = this.samples.length > 0 && this.cursor < this.samples.length - 1;
    const popping = this.pop.active;
    const hasParticle = this.particles.some((p) => p.alive);
    return playing || popping || hasParticle;
  }

  private requestDraw(): void {
    if (this.destroyed) return;
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.rafId = null;
    if (this.destroyed || this.cssW < 1 || this.cssH < 1) return;

    if (this.staticDirty) this.rebuildStatic();

    // advance sample cursor by elapsed time
    let ballSample: Sample | null = null;
    if (this.samples.length > 0) {
      const elapsed = now - this.playStart;
      const t = Math.min(1, elapsed / DROP_DURATION_MS);
      const targetIdx = t * (this.samples.length - 1);
      this.cursor = Math.min(this.samples.length - 1, Math.max(0, targetIdx));
      ballSample = this.interpolateSample(this.cursor);

      // peg-hit FX
      const intCursor = Math.floor(this.cursor);
      const cur = this.samples[intCursor];
      if (cur && cur.pegRow !== null && intCursor > this.landedFor) {
        this.emitPegHit(cur);
        this.landedFor = intCursor;
      }

      // landing
      if (t >= 1 && this.landedFor < 1_000_000) {
        this.triggerLanding(now);
      }
    }

    // tick particles
    if (POOL_SIZE[this.quality] > 0) {
      for (const p of this.particles) {
        if (!p.alive) continue;
        p.life += 16;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        if (p.life >= p.maxLife) p.alive = false;
      }
    }

    this.draw(ballSample, now);

    if (this.isAnimating()) {
      this.rafId = requestAnimationFrame(this.frame);
    } else if (this.pendingQuality !== null) {
      this.applyQuality(this.pendingQuality);
    }
  };

  private interpolateSample(cursor: number): Sample {
    const i0 = Math.floor(cursor);
    const i1 = Math.min(this.samples.length - 1, i0 + 1);
    const f = cursor - i0;
    const a = this.samples[i0];
    const b = this.samples[i1];
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      vy: a.vy + (b.vy - a.vy) * f,
      progress: a.progress + (b.progress - a.progress) * f,
      pegRow: a.pegRow,
    };
  }

  private triggerLanding(now: number): void {
    if (this.landedFor === 1_000_000) return;
    this.landedFor = 1_000_000;
    this.pop.active = true;
    this.pop.start = now;
    if (POOL_SIZE[this.quality] > 0) this.emitPopBurst();
    const cb = this.onLand;
    if (cb) {
      this.onLand = undefined;
      const slot = this.pop.slot;
      const mult = this.pop.multiplier;
      // defer to microtask: setState during rAF callback is fine in React 18+,
      // but microtask keeps React's batching predictable across versions.
      queueMicrotask(() => {
        try {
          cb(slot, mult);
        } catch {
          /* swallow — renderer must not crash from caller errors */
        }
      });
    }
  }

  private emitPegHit(sample: Sample): void {
    if (POOL_SIZE[this.quality] === 0) return;
    const { px, py } = this.toPx(sample.x, sample.y);
    const burst = this.quality === "high" ? 6 : 3;
    for (let i = 0; i < burst; i++) this.spawnParticle(px, py, "#67e8f9", 380);
  }

  private emitPopBurst(): void {
    const slotCount = SLOT_COUNT[this.rows];
    const cx = this.padX + ((this.pop.slot + 0.5) / slotCount) * (this.cssW - this.padX * 2);
    const cy = this.cssH - this.slotH / 2;
    const count = this.quality === "high" ? 48 : 18;
    const color = this.slotColor(this.pop.multiplier);
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 2 + Math.random() * 3.5;
      const p = this.acquireParticle();
      if (!p) break;
      p.alive = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(ang) * speed;
      p.vy = Math.sin(ang) * speed - 1.5;
      p.life = 0;
      p.maxLife = 600 + Math.random() * 300;
      p.color = color;
    }
  }

  private spawnParticle(x: number, y: number, color: string, life: number): void {
    const p = this.acquireParticle();
    if (!p) return;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 2.2;
    p.vy = -Math.random() * 2 - 0.5;
    p.life = 0;
    p.maxLife = life;
    p.color = color;
  }

  private acquireParticle(): Particle | null {
    for (const p of this.particles) if (!p.alive) return p;
    return null;
  }

  private toPx(nx: number, ny: number): { px: number; py: number } {
    const innerW = this.cssW - this.padX * 2;
    const innerH = this.cssH - this.padTop - this.slotH;
    return {
      px: this.padX + nx * innerW,
      py: this.padTop + ny * innerH,
    };
  }

  private slotColor(mult: number): string {
    const max = MAX_MULT[this.risk][this.rows] || 1;
    const norm = mult / max;
    if (norm >= 0.5) return "#fbbf24"; // gold
    if (norm >= 0.15) return "#22d3ee"; // cyan
    if (mult >= 1) return "#a3b8c4"; // muted (push/small win)
    return "#f43f5e"; // rose (loss)
  }

  // -------------------------------------------------- static layer (peg + slots)

  private rebuildStatic(): void {
    if (this.cssW < 1 || this.cssH < 1) return;
    const ctx = this.staticCtx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    const innerW = this.cssW - this.padX * 2;
    const innerH = this.cssH - this.padTop - this.slotH;
    // dynamic peg radius based on width
    const pegSpacing = innerW / (this.rows + 1);
    this.pegRadius = Math.max(2, Math.min(5, pegSpacing * 0.12));
    this.ballRadius = Math.max(3, this.pegRadius * 1.5);

    // pegs
    ctx.fillStyle = "#a3b8c4";
    if (this.quality === "high") {
      ctx.shadowColor = "rgba(103, 232, 249, 0.45)";
      ctx.shadowBlur = 6;
    }
    for (let row = 0; row < this.rows; row++) {
      const ny = (row + 1) / (this.rows + 1);
      const py = this.padTop + ny * innerH;
      const count = row + 2;
      for (let c = 0; c < count; c++) {
        // peg x: matches engine's (cumRight + 0.5) / (row + 2) — same formula.
        const nx = (c + 0.5) / count;
        const px = this.padX + nx * innerW;
        ctx.beginPath();
        ctx.arc(px, py, this.pegRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;

    // slots
    const slotCount = SLOT_COUNT[this.rows];
    const slotW = innerW / slotCount;
    const slotY = this.cssH - this.slotH;
    const table = MULTIPLIERS[this.risk][this.rows];
    for (let i = 0; i < slotCount; i++) {
      const mult = table[i];
      const color = this.slotColor(mult);
      const sx = this.padX + i * slotW + 1;
      const sw = slotW - 2;
      // body
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18;
      this.roundRect(ctx, sx, slotY, sw, this.slotH - 4, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
      // border
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      this.roundRect(ctx, sx, slotY, sw, this.slotH - 4, 6);
      ctx.stroke();
      // label
      ctx.fillStyle = color;
      const fontSize = Math.max(8, Math.min(11, sw * 0.32));
      ctx.font = `700 ${fontSize}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = mult >= 100 ? `${mult.toFixed(0)}x` : `${mult.toFixed(mult >= 10 ? 0 : mult >= 1 ? 1 : 1)}x`;
      ctx.fillText(label, sx + sw / 2, slotY + (this.slotH - 4) / 2);
    }

    this.staticDirty = false;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // -------------------------------------------------- composite frame

  private draw(ball: Sample | null, now: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.drawImage(this.staticCanvas, 0, 0, this.cssW, this.cssH);

    // trail
    if (ball && TRAIL_SAMPLES[this.quality] > 0) {
      const trailCount = TRAIL_SAMPLES[this.quality];
      const startCursor = Math.max(0, this.cursor - trailCount);
      for (let i = 0; i < trailCount; i++) {
        const c = startCursor + i;
        if (c < 0 || c >= this.samples.length) continue;
        const s = this.interpolateSample(c);
        const { px, py } = this.toPx(s.x, s.y);
        const alpha = (i / trailCount) * 0.35;
        ctx.fillStyle = `rgba(103, 232, 249, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, this.ballRadius * (0.4 + (i / trailCount) * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ball
    if (ball) {
      const { px, py } = this.toPx(ball.x, ball.y);
      if (this.quality === "high") {
        const grad = ctx.createRadialGradient(px - 1.5, py - 1.5, 0, px, py, this.ballRadius * 1.8);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.4, "#67e8f9");
        grad.addColorStop(1, "rgba(103, 232, 249, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, this.ballRadius * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, this.ballRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // particles
    if (POOL_SIZE[this.quality] > 0) {
      for (const p of this.particles) {
        if (!p.alive) continue;
        const a = 1 - p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + a * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // pop animation (slot flash + multiplier text)
    if (this.pop.active) {
      const t = (now - this.pop.start) / POP_DURATION_MS;
      if (t >= 1) {
        this.pop.active = false;
      } else {
        const slotCount = SLOT_COUNT[this.rows];
        const innerW = this.cssW - this.padX * 2;
        const slotW = innerW / slotCount;
        const sx = this.padX + this.pop.slot * slotW + 1;
        const slotY = this.cssH - this.slotH;
        const color = this.slotColor(this.pop.multiplier);
        // flash
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.fillStyle = color;
        this.roundRect(ctx, sx, slotY, slotW - 2, this.slotH - 4, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        // text rise
        const ty = slotY - 14 - t * 22;
        ctx.fillStyle = color;
        ctx.font = `800 ${14 + (1 - t) * 6}px ui-monospace, "SF Mono", Menlo, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 1 - t;
        ctx.fillText(`${this.pop.multiplier}x`, sx + (slotW - 2) / 2, ty);
        ctx.globalAlpha = 1;
      }
    }
  }
}

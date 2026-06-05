/**
 * PlinkoRenderer — Canvas 2D high-performance renderer (LUXURY EDITION).
 *
 * 역할: PlinkoEngine 결과를 시각화. 순수 Canvas 클래스, React/DOM 이벤트 0.
 * 3-Layer (static / dynamic / fx) + Dirty Rendering + 3-tier Quality + Particle Pool.
 *
 * Visual upgrades:
 *   - 3D beveled slots with internal gradients + landing squash
 *   - Glass-bead pegs (radial gradient + rim light) + heat-pulse on near-ball
 *   - Metallic ball with golden halo + streak trail + squash on impact
 *   - 3-layer landing burst (slot-color L1 + gold sparks L2 + white core L3)
 *   - Screen-space shake on big multipliers (≥5x: 4px, ≥10x: 8px)
 *   - Jackpot bloom: full-screen gold flash + slot pulse + slow fountain
 *   - Vignette glow background + grid texture
 *
 * Audio + haptic hooks via callbacks: onPegHit, onLand.
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
  onPegHit?: (velocity: number) => void;
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
  size: number;
  kind: "dot" | "spark" | "core";
}

interface PopAnim {
  active: boolean;
  slot: number;
  start: number;
  multiplier: number;
  jackpot: boolean;
}

interface ShakeState {
  active: boolean;
  start: number;
  amplitude: number;
  duration: number;
}

interface FlashState {
  active: boolean;
  start: number;
  color: string;
  duration: number;
}

const DROP_DURATION_MS = 1300;
const POP_DURATION_MS = 900;
const SLOT_SQUASH_MS = 380;
const POOL_SIZE: Record<QualityLevel, number> = { low: 0, medium: 64, high: 160 };
const TRAIL_SAMPLES: Record<QualityLevel, number> = { low: 0, medium: 10, high: 28 };

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
  private onPegHitCb?: (velocity: number) => void;

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
  private pop: PopAnim = { active: false, slot: -1, start: 0, multiplier: 0, jackpot: false };
  private shake: ShakeState = { active: false, start: 0, amplitude: 0, duration: 0 };
  private flash: FlashState = { active: false, start: 0, color: "#ffffff", duration: 0 };

  /** Recent peg-hit timestamps per peg index — for heat-pulse rendering. */
  private pegHeat: Map<string, number> = new Map();
  /** Per-slot squash animation (slot index -> start time ms). */
  private slotSquash: Map<number, number> = new Map();
  /** Last sample for ball squash detection (velocity spike on peg hit). */
  private ballSquashUntil = 0;

  private pendingQuality: QualityLevel | null = null;
  private destroyed = false;

  // layout
  private pegRadius = 4;
  private ballRadius = 6;
  private padX = 12;
  private padTop = 16;
  private slotH = 44;

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
    this.onPegHitCb = opts.onPegHit;
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
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.samples.length = 0;
    this.cursor = 0;
    this.landedFor = -1;
    this.pop.active = false;
    this.shake.active = false;
    this.flash.active = false;
    this.pegHeat.clear();
    this.slotSquash.clear();
    this.ballSquashUntil = 0;
    for (const p of this.particles) p.alive = false;

    engine.simulatePhysics(result, (x, y, vy, progress) => {
      const pegRow = this.derivePegRow(progress, result.totalRows);
      this.samples.push({ x, y, vy, progress, pegRow });
    });
    if (this.samples.length === 0) return;

    this.playStart = performance.now();
    this.onLand = onLand;

    this.pop.slot = result.finalSlot;
    this.pop.multiplier = result.multiplier;
    this.pop.jackpot = this.isJackpot(result.multiplier);

    this.requestDraw();
  }

  stop(): void {
    this.samples.length = 0;
    this.cursor = 0;
    this.pop.active = false;
    this.shake.active = false;
    this.flash.active = false;
    this.pegHeat.clear();
    this.slotSquash.clear();
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
      size: 2,
      kind: "dot" as const,
    }));
  }

  private applyQuality(q: QualityLevel): void {
    this.quality = q;
    this.pendingQuality = null;
    this.initPool();
    this.staticDirty = true;
    this.requestDraw();
  }

  private isJackpot(mult: number): boolean {
    const max = MAX_MULT[this.risk][this.rows] || 1;
    return mult >= max * 0.5 && mult >= 5;
  }

  private derivePegRow(progress: number, rows: RowCount): number | null {
    const t = progress * (rows + 1);
    const row = Math.floor(t);
    const frac = t - row;
    if (row < rows && frac >= 13 / 14) return row;
    return null;
  }

  private isAnimating(): boolean {
    const playing = this.samples.length > 0 && this.cursor < this.samples.length - 1;
    const popping = this.pop.active;
    const hasParticle = this.particles.some((p) => p.alive);
    const shaking = this.shake.active;
    const flashing = this.flash.active;
    const slotAnim = this.slotSquash.size > 0;
    return playing || popping || hasParticle || shaking || flashing || slotAnim;
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

    let ballSample: Sample | null = null;
    if (this.samples.length > 0) {
      const elapsed = now - this.playStart;
      const t = Math.min(1, elapsed / DROP_DURATION_MS);
      const targetIdx = t * (this.samples.length - 1);
      this.cursor = Math.min(this.samples.length - 1, Math.max(0, targetIdx));
      ballSample = this.interpolateSample(this.cursor);

      const intCursor = Math.floor(this.cursor);
      const cur = this.samples[intCursor];
      if (cur && cur.pegRow !== null && intCursor > this.landedFor) {
        this.emitPegHit(cur);
        this.landedFor = intCursor;
      }

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
        p.vy += 0.22;
        p.vx *= 0.98;
        if (p.life >= p.maxLife) p.alive = false;
      }
    }

    // expire heat
    if (this.pegHeat.size > 0) {
      for (const [k, t0] of this.pegHeat) {
        if (now - t0 > 320) this.pegHeat.delete(k);
      }
    }
    // expire slot squash
    if (this.slotSquash.size > 0) {
      for (const [k, t0] of this.slotSquash) {
        if (now - t0 > SLOT_SQUASH_MS) this.slotSquash.delete(k);
      }
    }

    this.draw(ballSample, now);

    if (this.isAnimating()) {
      this.rafId = requestAnimationFrame(this.frame);
    } else if (this.pendingQuality !== null) {
      this.applyQuality(this.pendingQuality);
    }
  };

  private interpolateSample(cursor: number): Sample | null {
    const len = this.samples.length;
    if (len === 0) return null;
    const i0 = Math.max(0, Math.min(len - 1, Math.floor(cursor)));
    const i1 = Math.min(len - 1, i0 + 1);
    const a = this.samples[i0];
    const b = this.samples[i1];
    if (!a || !b) return null;
    const f = cursor - i0;
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
    this.slotSquash.set(this.pop.slot, now);
    this.ballSquashUntil = now + 80;

    const mult = this.pop.multiplier;
    const max = MAX_MULT[this.risk][this.rows] || 1;
    const norm = mult / max;

    // shake
    if (mult >= 10 || norm >= 0.75) {
      this.shake = { active: true, start: now, amplitude: 8, duration: 320 };
    } else if (mult >= 5 || norm >= 0.4) {
      this.shake = { active: true, start: now, amplitude: 4, duration: 220 };
    }

    // flash
    if (this.pop.jackpot) {
      this.flash = { active: true, start: now, color: "#ffe27a", duration: 420 };
    }

    if (POOL_SIZE[this.quality] > 0) this.emitLandingBurst();

    const cb = this.onLand;
    if (cb) {
      this.onLand = undefined;
      const slot = this.pop.slot;
      queueMicrotask(() => {
        try {
          cb(slot, mult);
        } catch {
          /* swallow */
        }
      });
    }
  }

  private emitPegHit(sample: Sample): void {
    // peg coords for heat
    const row = sample.pegRow ?? 0;
    const slotCount = this.rows + 2;
    const col = Math.round(sample.x * (row + 1));
    const k = `${row}:${col}`;
    this.pegHeat.set(k, performance.now());

    // SFX callback (velocity-scaled)
    const vel = Math.min(1, Math.abs(sample.vy) / 5);
    if (this.onPegHitCb) {
      try {
        this.onPegHitCb(vel);
      } catch {
        /* swallow */
      }
    }
    void slotCount;

    if (POOL_SIZE[this.quality] === 0) return;
    const { px, py } = this.toPx(sample.x, sample.y);
    const burst = this.quality === "high" ? 5 : 3;
    for (let i = 0; i < burst; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 1.2 + Math.random() * 1.6;
      this.spawnParticle(
        px,
        py,
        "#a5f3fc",
        300,
        Math.cos(ang) * speed,
        Math.sin(ang) * speed,
        1.4,
        "spark",
      );
    }
  }

  private emitLandingBurst(): void {
    const slotCount = SLOT_COUNT[this.rows];
    const cx = this.padX + ((this.pop.slot + 0.5) / slotCount) * (this.cssW - this.padX * 2);
    const cy = this.cssH - this.slotH / 2;
    const color = this.slotColor(this.pop.multiplier);
    const jackpot = this.pop.jackpot;

    // L1: slot-color large
    const l1 = this.quality === "high" ? (jackpot ? 48 : 28) : 16;
    for (let i = 0; i < l1; i++) {
      const ang = (Math.PI * 2 * i) / l1 + Math.random() * 0.4;
      const speed = 2.2 + Math.random() * 3.5;
      this.spawnParticle(
        cx,
        cy,
        color,
        700 + Math.random() * 300,
        Math.cos(ang) * speed,
        Math.sin(ang) * speed - 1.5,
        2.6 + Math.random() * 1.4,
        "dot",
      );
    }
    // L2: gold sparks
    const l2 = this.quality === "high" ? (jackpot ? 32 : 18) : 10;
    for (let i = 0; i < l2; i++) {
      const ang = (Math.PI * 2 * i) / l2 + Math.random() * 0.6;
      const speed = 3.5 + Math.random() * 4;
      this.spawnParticle(
        cx,
        cy,
        "#fde68a",
        450 + Math.random() * 200,
        Math.cos(ang) * speed,
        Math.sin(ang) * speed - 2,
        1.6,
        "spark",
      );
    }
    // L3: white core (short, big)
    const l3 = this.quality === "high" ? 6 : 3;
    for (let i = 0; i < l3; i++) {
      this.spawnParticle(cx, cy, "#ffffff", 160, 0, 0, 14, "core");
    }

    // Jackpot fountain (extra)
    if (jackpot && this.quality === "high") {
      for (let i = 0; i < 24; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const speed = 4 + Math.random() * 3;
        this.spawnParticle(
          cx,
          cy,
          Math.random() > 0.5 ? "#fbbf24" : "#ffffff",
          1200 + Math.random() * 400,
          Math.cos(ang) * speed,
          Math.sin(ang) * speed - 2.5,
          2,
          "spark",
        );
      }
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    color: string,
    life: number,
    vx: number,
    vy: number,
    size: number,
    kind: Particle["kind"],
  ): void {
    const p = this.acquireParticle();
    if (!p) return;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = 0;
    p.maxLife = life;
    p.color = color;
    p.size = size;
    p.kind = kind;
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
    if (mult >= 1) return "#94a3b8"; // muted
    return "#f43f5e"; // rose
  }

  // -------------------------------------------------- static layer

  private rebuildStatic(): void {
    if (this.cssW < 1 || this.cssH < 1) return;
    const ctx = this.staticCtx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    // background gradient + vignette
    const bgGrad = ctx.createRadialGradient(
      this.cssW / 2,
      this.cssH * 0.45,
      0,
      this.cssW / 2,
      this.cssH * 0.45,
      Math.max(this.cssW, this.cssH) * 0.75,
    );
    bgGrad.addColorStop(0, "rgba(34, 211, 238, 0.08)");
    bgGrad.addColorStop(0.55, "rgba(10, 15, 26, 0)");
    bgGrad.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    // subtle grid
    if (this.quality !== "low") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      const step = 28;
      for (let x = 0; x < this.cssW; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, this.cssH);
        ctx.stroke();
      }
      for (let y = 0; y < this.cssH; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(this.cssW, y + 0.5);
        ctx.stroke();
      }
    }

    const innerW = this.cssW - this.padX * 2;
    const innerH = this.cssH - this.padTop - this.slotH;
    const pegSpacing = innerW / (this.rows + 1);
    this.pegRadius = Math.max(2.5, Math.min(5.5, pegSpacing * 0.13));
    this.ballRadius = Math.max(3.5, this.pegRadius * 1.55);

    // pegs — glass beads (radial gradient + rim)
    for (let row = 0; row < this.rows; row++) {
      const ny = (row + 1) / (this.rows + 1);
      const py = this.padTop + ny * innerH;
      const count = row + 2;
      for (let c = 0; c < count; c++) {
        const nx = (c + 0.5) / count;
        const px = this.padX + nx * innerW;
        this.drawPeg(ctx, px, py, this.pegRadius, false);
      }
    }

    // slots — 3D beveled
    const slotCount = SLOT_COUNT[this.rows];
    const slotW = innerW / slotCount;
    const slotY = this.cssH - this.slotH;
    const table = MULTIPLIERS[this.risk][this.rows];
    for (let i = 0; i < slotCount; i++) {
      const mult = table[i];
      const color = this.slotColor(mult);
      const sx = this.padX + i * slotW + 1;
      const sw = slotW - 2;
      this.drawSlot(ctx, sx, slotY, sw, this.slotH - 4, color, mult, 1);
    }

    this.staticDirty = false;
  }

  private drawPeg(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    r: number,
    hot: boolean,
  ): void {
    // outer halo (hot only)
    if (hot) {
      const halo = ctx.createRadialGradient(px, py, r, px, py, r * 4);
      halo.addColorStop(0, "rgba(167, 243, 252, 0.55)");
      halo.addColorStop(1, "rgba(167, 243, 252, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // body radial gradient
    const g = ctx.createRadialGradient(px - r * 0.4, py - r * 0.4, 0, px, py, r);
    if (hot) {
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, "#a5f3fc");
      g.addColorStop(1, "#0891b2");
    } else {
      g.addColorStop(0, "#e2e8f0");
      g.addColorStop(0.5, "#94a3b8");
      g.addColorStop(1, "#475569");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    // rim
    ctx.strokeStyle = hot ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
    // top specular dot
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(px - r * 0.35, py - r * 0.4, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSlot(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    color: string,
    mult: number,
    scaleY: number,
  ): void {
    const r = 6;
    const drawY = sy + (sh * (1 - scaleY)) / 2;
    const drawH = sh * scaleY;

    // body gradient (top dark → bottom color)
    const grad = ctx.createLinearGradient(sx, drawY, sx, drawY + drawH);
    grad.addColorStop(0, `color-mix(in oklab, ${color} 8%, transparent)`);
    grad.addColorStop(0.5, `color-mix(in oklab, ${color} 22%, transparent)`);
    grad.addColorStop(1, `color-mix(in oklab, ${color} 38%, transparent)`);

    ctx.fillStyle = grad;
    this.roundRect(ctx, sx, drawY, sw, drawH, r);
    ctx.fill();

    // top highlight (bevel)
    ctx.strokeStyle = `color-mix(in oklab, ${color} 85%, white)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + r, drawY + 0.5);
    ctx.lineTo(sx + sw - r, drawY + 0.5);
    ctx.stroke();

    // bottom shadow (bevel)
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + r, drawY + drawH - 0.5);
    ctx.lineTo(sx + sw - r, drawY + drawH - 0.5);
    ctx.stroke();

    // outer border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    this.roundRect(ctx, sx, drawY, sw, drawH, r);
    ctx.stroke();

    // label
    ctx.fillStyle = color;
    const fontSize = Math.max(10, Math.min(15, sw * 0.42));
    ctx.font = `800 ${fontSize}px ui-monospace, "SF Mono", Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label =
      mult >= 100 ? `${mult.toFixed(0)}x` : `${mult.toFixed(mult >= 10 ? 0 : mult >= 1 ? 1 : 1)}x`;
    ctx.shadowColor = `color-mix(in oklab, ${color} 80%, transparent)`;
    ctx.shadowBlur = 4;
    ctx.fillText(label, sx + sw / 2, drawY + drawH / 2);
    ctx.shadowBlur = 0;
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

    // screen shake offset
    let shakeX = 0;
    let shakeY = 0;
    if (this.shake.active) {
      const t = (now - this.shake.start) / this.shake.duration;
      if (t >= 1) {
        this.shake.active = false;
      } else {
        const decay = (1 - t) * (1 - t);
        const amp = this.shake.amplitude * decay;
        shakeX = (Math.random() - 0.5) * 2 * amp;
        shakeY = (Math.random() - 0.5) * 2 * amp;
      }
    }
    if (shakeX || shakeY) ctx.translate(shakeX, shakeY);

    ctx.drawImage(this.staticCanvas, 0, 0, this.cssW, this.cssH);

    // hot peg overlays (heat-pulse)
    if (this.pegHeat.size > 0) this.drawHotPegs(now);

    // slot squash overrides (re-draw squashed slots over the static layer)
    if (this.slotSquash.size > 0) this.drawSquashedSlots(now);

    // trail (streak)
    if (ball && TRAIL_SAMPLES[this.quality] > 0) {
      const trailCount = TRAIL_SAMPLES[this.quality];
      const startCursor = Math.max(0, this.cursor - trailCount);
      for (let i = 0; i < trailCount; i++) {
        const c = startCursor + i;
        if (c < 0 || c >= this.samples.length) continue;
        const s = this.interpolateSample(c);
        if (!s) continue;
        const { px, py } = this.toPx(s.x, s.y);
        const ratio = i / trailCount;
        const alpha = ratio * 0.45;
        ctx.fillStyle = `rgba(253, 230, 138, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, this.ballRadius * (0.35 + ratio * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ball (metallic with halo + squash)
    if (ball) {
      const { px, py } = this.toPx(ball.x, ball.y);
      const squash = now < this.ballSquashUntil;
      const sx = squash ? 1.18 : 1;
      const sy = squash ? 0.82 : 1;

      // outer golden halo
      if (this.quality !== "low") {
        const halo = ctx.createRadialGradient(px, py, 0, px, py, this.ballRadius * 2.4);
        halo.addColorStop(0, "rgba(253, 230, 138, 0.65)");
        halo.addColorStop(0.5, "rgba(251, 191, 36, 0.25)");
        halo.addColorStop(1, "rgba(251, 191, 36, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(px, py, this.ballRadius * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // body metallic
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(sx, sy);
      const bg = ctx.createRadialGradient(
        -this.ballRadius * 0.4,
        -this.ballRadius * 0.4,
        0,
        0,
        0,
        this.ballRadius,
      );
      bg.addColorStop(0, "#ffffff");
      bg.addColorStop(0.45, "#fde68a");
      bg.addColorStop(1, "#b45309");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, this.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      // rim
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // specular
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(
        -this.ballRadius * 0.4,
        -this.ballRadius * 0.45,
        this.ballRadius * 0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    // particles
    if (POOL_SIZE[this.quality] > 0) {
      for (const p of this.particles) {
        if (!p.alive) continue;
        const a = 1 - p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, a);
        if (p.kind === "core") {
          // white radial flash, scales with life
          const r = p.size * (1 + (1 - a) * 2);
          const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          gg.addColorStop(0, "rgba(255,255,255,1)");
          gg.addColorStop(0.5, "rgba(255,255,255,0.4)");
          gg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "spark") {
          // small streak
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // dot
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // pop animation (text rise over slot)
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
        // text rise
        const ty = slotY - 18 - t * 30;
        const fontScale = this.pop.jackpot ? 1.6 : 1;
        ctx.fillStyle = color;
        ctx.font = `900 ${(18 + (1 - t) * 10) * fontScale}px ui-monospace, "SF Mono", Menlo, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 1 - t;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillText(`${this.pop.multiplier}x`, sx + (slotW - 2) / 2, ty);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    // restore shake
    if (shakeX || shakeY) ctx.translate(-shakeX, -shakeY);

    // full-screen flash (over everything, no shake)
    if (this.flash.active) {
      const t = (now - this.flash.start) / this.flash.duration;
      if (t >= 1) {
        this.flash.active = false;
      } else {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = (1 - t) * 0.55;
        ctx.fillStyle = this.flash.color;
        ctx.fillRect(0, 0, this.cssW, this.cssH);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  private drawHotPegs(now: number): void {
    if (this.cssW < 1) return;
    const ctx = this.ctx;
    const innerW = this.cssW - this.padX * 2;
    const innerH = this.cssH - this.padTop - this.slotH;
    for (const [k, t0] of this.pegHeat) {
      const age = now - t0;
      if (age > 320) continue;
      const [rowStr, colStr] = k.split(":");
      const row = +rowStr;
      const col = +colStr;
      const ny = (row + 1) / (this.rows + 1);
      const py = this.padTop + ny * innerH;
      const count = row + 2;
      const nx = (col + 0.5) / count;
      const px = this.padX + nx * innerW;
      ctx.globalAlpha = Math.max(0, 1 - age / 320);
      this.drawPeg(ctx, px, py, this.pegRadius * (1 + (1 - age / 320) * 0.2), true);
      ctx.globalAlpha = 1;
    }
  }

  private drawSquashedSlots(now: number): void {
    const ctx = this.ctx;
    const slotCount = SLOT_COUNT[this.rows];
    const innerW = this.cssW - this.padX * 2;
    const slotW = innerW / slotCount;
    const slotY = this.cssH - this.slotH;
    const table = MULTIPLIERS[this.risk][this.rows];
    for (const [i, t0] of this.slotSquash) {
      const age = now - t0;
      if (age > SLOT_SQUASH_MS) continue;
      const t = age / SLOT_SQUASH_MS;
      // squash curve: 1 -> 0.88 -> 1 (ease out back)
      const scaleY = 1 - 0.12 * Math.sin(Math.PI * t);
      // clear that slot region first
      const sx = this.padX + i * slotW + 1;
      const sw = slotW - 2;
      ctx.clearRect(sx - 2, slotY - 2, sw + 4, this.slotH);
      const mult = table[i];
      this.drawSlot(ctx, sx, slotY, sw, this.slotH - 4, this.slotColor(mult), mult, scaleY);
    }
  }
}

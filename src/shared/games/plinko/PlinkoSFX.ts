/**
 * PlinkoSFX — Procedural WebAudio sound effects (zero deps, zero network).
 *
 * Lazy AudioContext (created on first user gesture). All sounds synthesized
 * from oscillators + noise + envelopes. Single global instance via getter.
 *
 * Public API:
 *   const sfx = getPlinkoSFX();
 *   sfx.resume();                   // call on first user gesture
 *   sfx.pegHit(velocity);
 *   sfx.ballRelease();
 *   sfx.landSound(multiplier, maxMultiplier);
 *   sfx.setMuted(true);
 */

type Tier = "loss" | "small" | "mid" | "big" | "jackpot";

class PlinkoSFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private lastPegHitAt = 0;

  /** Throttle: ignore peg hits within this window (ms). */
  private readonly PEG_THROTTLE_MS = 22;

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Call from a user-gesture handler to unlock audio. Safe to call repeatedly. */
  resume(): void {
    this.ensureCtx();
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  private ensureCtx(): boolean {
    if (this.ctx) return true;
    try {
      const Ctor =
        typeof window !== "undefined"
          ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
          : null;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  pegHit(velocity: number): void {
    if (this.muted) return;
    if (!this.ensureCtx() || !this.ctx || !this.master) return;
    const now = performance.now();
    if (now - this.lastPegHitAt < this.PEG_THROTTLE_MS) return;
    this.lastPegHitAt = now;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = Math.max(0.04, Math.min(0.18, velocity * 0.08));

    // High click (sine) + low body (triangle)
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(1800 + Math.random() * 600, t);
    o1.frequency.exponentialRampToValueAtTime(900, t + 0.04);

    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(280, t);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

    o1.connect(g);
    o2.connect(g);
    g.connect(this.master);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 0.06);
    o2.stop(t + 0.06);
  }

  ballRelease(): void {
    if (this.muted) return;
    if (!this.ensureCtx() || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Short white-noise woosh through a lowpass sweep.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.22);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.26);
  }

  landSound(multiplier: number, maxMult: number): void {
    if (this.muted) return;
    if (!this.ensureCtx() || !this.ctx || !this.master) return;

    const tier = this.tierFor(multiplier, maxMult);
    switch (tier) {
      case "loss":
        this.thud();
        break;
      case "small":
        this.chime([659.25, 783.99], 0.25); // E5 + G5
        break;
      case "mid":
        this.arpeggio([523.25, 659.25, 783.99], 0.07, 0.32);
        break;
      case "big":
        this.arpeggio([523.25, 659.25, 783.99, 1046.5], 0.06, 0.45);
        this.bell(1318.5, 0.6);
        break;
      case "jackpot":
        this.fanfare();
        break;
    }
  }

  private tierFor(mult: number, max: number): Tier {
    if (mult < 1) return "loss";
    const norm = mult / Math.max(1, max);
    if (norm >= 0.5) return "jackpot";
    if (mult >= 5) return "big";
    if (mult >= 2) return "mid";
    return "small";
  }

  private thud(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + 0.24);
  }

  private chime(freqs: number[], dur: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }

  private arpeggio(freqs: number[], step: number, tail: number): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const t = t0 + i * step;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + tail);
      o.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + tail + 0.02);
    });
  }

  private bell(freq: number, dur: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.05;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    o2.connect(g);
    g.connect(this.master!);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private fanfare(): void {
    // Golden glissando + sustained bell
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
    notes.forEach((f, i) => {
      const t = t0 + i * 0.07;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.value = f * 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g);
      o2.connect(g);
      g.connect(this.master!);
      o.start(t);
      o2.start(t);
      o.stop(t + 0.55);
      o2.stop(t + 0.55);
    });
    // sustained bell
    this.bell(1046.5, 1.2);
    // shimmer noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * 0.25 * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4000;
    const sg = ctx.createGain();
    sg.gain.value = 0.18;
    src.connect(hp);
    hp.connect(sg);
    sg.connect(this.master!);
    src.start(t0 + 0.1);
    src.stop(t0 + 0.9);
  }
}

let _singleton: PlinkoSFX | null = null;
export function getPlinkoSFX(): PlinkoSFX {
  if (!_singleton) _singleton = new PlinkoSFX();
  return _singleton;
}

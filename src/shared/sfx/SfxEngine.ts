/**
 * SfxEngine — Web Audio single entry for game UI sounds (client-only).
 */
import { sfxStore } from "@/shared/games/state/persistedGameState";

export type SfxId = "bet" | "win" | "loss" | "tick" | "cashout" | "jackpot" | "peg";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMuted(): boolean {
  const { enabled } = sfxStore.get();
  return !enabled || prefersReducedMotion();
}

function tone(freq: number, duration: number, type: OscillatorType, gainPeak: number) {
  const audio = getContext();
  if (!audio || isMuted()) return;
  void audio.resume().catch(() => undefined);
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const volume = sfxStore.get().volume;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainPeak * volume, audio.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration + 0.02);
}

const PRESETS: Record<SfxId, () => void> = {
  bet: () => tone(440, 0.08, "square", 0.12),
  win: () => {
    tone(523, 0.1, "sine", 0.14);
    window.setTimeout(() => tone(784, 0.12, "sine", 0.1), 60);
  },
  loss: () => tone(180, 0.15, "sawtooth", 0.1),
  tick: () => tone(900, 0.03, "square", 0.06),
  cashout: () => tone(660, 0.14, "triangle", 0.13),
  jackpot: () => {
    tone(392, 0.12, "sine", 0.12);
    window.setTimeout(() => tone(523, 0.12, "sine", 0.12), 80);
    window.setTimeout(() => tone(784, 0.18, "sine", 0.14), 160);
  },
  peg: () => tone(1200, 0.025, "sine", 0.05),
};

export function playSfx(id: SfxId): void {
  if (typeof window === "undefined" || isMuted()) return;
  PRESETS[id]?.();
}

export function setSfxVolume(volume: number): void {
  sfxStore.set((s) => ({ ...s, volume: Math.max(0, Math.min(1, volume)) }));
}

export function setSfxEnabled(enabled: boolean): void {
  sfxStore.set((s) => ({ ...s, enabled }));
}

/** Test-only reset */
export function __resetSfxEngineForTests(): void {
  ctx = null;
}

/**
 * PlinkoSFX — ROUND M: SfxEngine 위임 wrapper.
 *
 * 변경: 자체 AudioContext 제거. 모든 사운드는 `@/shared/sfx/SfxEngine`을 통한다.
 * mute는 SfxEngine 글로벌 mute (sfxStore.enabled) 와 동기화.
 *
 * Public API는 기존 호출부 호환을 위해 동일하게 유지.
 */
import { playSfx, setSfxEnabled } from "@/shared/sfx/SfxEngine";

class PlinkoSFX {
  private muted = false;
  private lastPegAt = 0;
  /** Throttle: ignore peg hits within this window (ms). */
  private readonly PEG_THROTTLE_MS = 22;

  setMuted(m: boolean): void {
    this.muted = m;
    // Mirror to global SfxEngine so all games stay in sync.
    setSfxEnabled(!m);
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** SfxEngine creates/resumes ctx lazily on first playSfx — no-op kept for API parity. */
  resume(): void {
    /* noop — SfxEngine handles AudioContext lifecycle. */
  }

  pegHit(_velocity: number): void {
    if (this.muted) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - this.lastPegAt < this.PEG_THROTTLE_MS) return;
    this.lastPegAt = now;
    playSfx("peg");
  }

  ballRelease(): void {
    if (this.muted) return;
    playSfx("bet");
  }

  landSound(multiplier: number, maxMult: number): void {
    if (this.muted) return;
    if (multiplier < 1) {
      playSfx("loss");
      return;
    }
    const norm = multiplier / Math.max(1, maxMult);
    if (norm >= 0.5 || multiplier >= 10) {
      playSfx("jackpot");
    } else {
      playSfx("win");
    }
  }
}

let _singleton: PlinkoSFX | null = null;
export function getPlinkoSFX(): PlinkoSFX {
  if (!_singleton) _singleton = new PlinkoSFX();
  return _singleton;
}

/** Test-only reset. */
export function __resetPlinkoSFXForTests(): void {
  _singleton = null;
}

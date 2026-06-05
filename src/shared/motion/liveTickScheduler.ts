/**
 * Global RAF-based tick scheduler.
 *
 * Replaces per-component setTimeout loops in LiveNumber / liveOnlineStore /
 * CountUp animations. One shared rAF loop iterates registered subscribers,
 * pauses when document is hidden, and respects prefers-reduced-motion.
 *
 * Each subscriber declares a desired interval (ms). The loop fires the
 * callback at most once per interval. This eliminates timer storms when
 * many "live" numbers are on screen — a major source of UI lag.
 */

type Subscriber = {
  cb: (now: number) => void;
  intervalMs: number;
  nextAt: number;
};

const subs = new Set<Subscriber>();
let rafId: number | null = null;
let running = false;

function loop(now: number) {
  rafId = null;
  if (typeof document !== "undefined" && document.hidden) {
    // Will resume on visibilitychange.
    running = false;
    return;
  }
  subs.forEach((s) => {
    if (now >= s.nextAt) {
      try {
        s.cb(now);
      } catch {
        /* swallow — never let a single sub crash the loop */
      }
      const jitter = s.intervalMs * (0.6 + Math.random() * 0.8);
      s.nextAt = now + jitter;
    }
  });
  if (subs.size > 0) {
    rafId = requestAnimationFrame(loop);
  } else {
    running = false;
  }
}

function ensureRunning() {
  if (running || typeof window === "undefined") return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  running = true;
  rafId = requestAnimationFrame(loop);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && subs.size > 0 && !running) {
      // Reset nextAt so subs don't all fire at once after resume.
      const now = performance.now();
      subs.forEach((s) => {
        s.nextAt = now + s.intervalMs * (0.6 + Math.random() * 0.8);
      });
      ensureRunning();
    }
  });
}

/**
 * Subscribe to the global tick loop. Returns an unsubscribe function.
 * The callback receives the current performance.now() timestamp.
 */
export function subscribeLiveTick(
  cb: (now: number) => void,
  intervalMs: number,
): () => void {
  const sub: Subscriber = {
    cb,
    intervalMs,
    nextAt:
      (typeof performance !== "undefined" ? performance.now() : 0) +
      intervalMs * (0.6 + Math.random() * 0.8),
  };
  subs.add(sub);
  ensureRunning();
  return () => {
    subs.delete(sub);
    if (subs.size === 0 && rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      running = false;
    }
  };
}

/**
 * Single-RAF master tick loop.
 *
 * All games on a given screen subscribe to ONE tick loop.
 * - Multiple Canvases sharing the same RAF = guaranteed sync, no rogue loops.
 * - Frame-drop detector (dt > 16.7ms) emits dev-only console.warn.
 *
 * Pure browser API (no React). React adapters live elsewhere.
 */

export type TickFn = (dtMs: number, nowMs: number) => void;

export interface TickLoop {
  subscribe(fn: TickFn): () => void;
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

interface CreateOpts {
  /** Frame budget in ms. Default 16.7 (60fps). dt > budget triggers dev warn. */
  frameBudgetMs?: number;
  /** Override label used in warnings (e.g. "crash", "keepy-uppy"). */
  label?: string;
}

const IS_DEV = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export function createTickLoop(opts: CreateOpts = {}): TickLoop {
  const budget = opts.frameBudgetMs ?? 16.7;
  const label = opts.label ?? "tick";
  const subs = new Set<TickFn>();
  let rafId = 0;
  let running = false;
  let lastTs = 0;

  function frame(ts: number) {
    if (!running) return;
    const dt = lastTs === 0 ? 0 : ts - lastTs;
    lastTs = ts;

    if (IS_DEV && dt > budget && dt < 1000) {
      // Single line, structured — easy to grep in devtools.
      console.warn(`[tickLoop:${label}] frame dropped: ${dt.toFixed(2)}ms (budget ${budget}ms)`);
    }

    for (const fn of subs) {
      try {
        fn(dt, ts);
      } catch (err) {
        console.error(`[tickLoop:${label}] subscriber threw`, err);
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  return {
    subscribe(fn) {
      subs.add(fn);
      if (!running && subs.size > 0) this.start();
      return () => {
        subs.delete(fn);
        if (subs.size === 0) this.stop();
      };
    },
    start() {
      if (running) return;
      running = true;
      lastTs = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },
    isRunning() {
      return running;
    },
  };
}

/** Lazy, shared singleton — most game screens should use this. */
let _shared: TickLoop | null = null;
export function sharedTickLoop(): TickLoop {
  if (!_shared) _shared = createTickLoop({ label: "shared" });
  return _shared;
}

/**
 * Shared "live online users" store.
 *
 * Single source of truth so chip + hero stat tick in sync. Uses the global
 * RAF scheduler (`liveTickScheduler`) instead of its own setTimeout loop.
 */
import { useSyncExternalStore } from "react";
import { MOCK_ONLINE_BASE } from "@/mocks/fomo";
import { subscribeLiveTick } from "./liveTickScheduler";

const BASE = MOCK_ONLINE_BASE;
const AMP = 0.003;
const BIAS = 0.52;
const INTERVAL = 2800;

let current = BASE;
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

function gaussian() {
  const u = Math.random() || 1e-9;
  const v = Math.random() || 1e-9;
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-2, Math.min(2, g));
}

function tick() {
  const dir = Math.random() < BIAS ? 1 : -1;
  const stepRatio = 0.0002 + Math.abs(gaussian()) * 0.0006;
  const delta = BASE * stepRatio * dir;
  let next = current + delta;
  const lo = BASE * (1 - AMP);
  const hi = BASE * (1 + AMP);
  if (next < lo) next = current + Math.abs(delta);
  if (next > hi) next = current - Math.abs(delta);
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    unsubscribe = subscribeLiveTick(tick, INTERVAL);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return BASE;
}

export function useLiveOnline(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

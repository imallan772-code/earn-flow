/**
 * 전역 "실시간 접속자" 숫자 스토어.
 * 칩과 히어로 stat이 동일한 값을 구독하도록 단일 jitter 루프를 운영한다.
 */
import { useSyncExternalStore } from "react";
import { MOCK_ONLINE_BASE } from "@/mocks/fomo";

const BASE = MOCK_ONLINE_BASE;
const AMP = 0.003;
const BIAS = 0.52;
const INTERVAL = 2800;

let current = BASE;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function gaussian() {
  const u = Math.random() || 1e-9;
  const v = Math.random() || 1e-9;
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-2, Math.min(2, g));
}

function tick() {
  if (typeof document === "undefined" || !document.hidden) {
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
  const jitter = INTERVAL * (0.6 + Math.random() * 0.8);
  timer = setTimeout(tick, jitter);
}

function start() {
  if (timer != null || typeof window === "undefined") return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  timer = setTimeout(tick, INTERVAL);
}

function stop() {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stop();
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

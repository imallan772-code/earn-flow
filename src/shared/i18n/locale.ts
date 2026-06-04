/**
 * Locale state — single source of truth for current UI language.
 * Lightweight; expand by adding messages.<lang>.ts + the union below.
 */
export type Locale = "ko" | "en";

const KEY = "phonara.locale";
const DEFAULT_LOCALE: Locale = "ko";

let current: Locale = readInitial();
const listeners = new Set<(l: Locale) => void>();

function readInitial(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const v = window.localStorage.getItem(KEY);
  return v === "en" || v === "ko" ? v : DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(l: Locale): void {
  current = l;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, l);
  }
  listeners.forEach((fn) => fn(l));
}

export function subscribeLocale(fn: (l: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

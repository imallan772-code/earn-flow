import { useEffect } from "react";

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  parts.push(k);
  return parts.join("+");
}

export function useHotkeys(map: HotkeyMap, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const key = normalizeKey(e);
      const fn = map[key] ?? map[e.key] ?? map[e.key.toLowerCase()];
      if (!fn) return;
      fn(e);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map, enabled]);
}

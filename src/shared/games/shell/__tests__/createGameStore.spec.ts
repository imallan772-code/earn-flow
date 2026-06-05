/**
 * createGameStore spec — 외부 시그니처·머지 규칙·debounce 검증.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createGameStore } from "../createGameStore";

interface FooState {
  count: number;
  label: string;
  nested?: { keep: boolean };
}

const INITIAL: FooState = { count: 0, label: "init" };

beforeEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

describe("createGameStore", () => {
  it("hydrates from existing localStorage and merges with initial", () => {
    window.localStorage.setItem(
      "phonara.gamestate.foo.v1",
      JSON.stringify({ count: 42 }),
    );
    const store = createGameStore<FooState>("foo", INITIAL, 1);
    expect(store.get()).toEqual({ count: 42, label: "init" });
  });

  it("set() updates state, notifies subscribers, and persists after debounce", async () => {
    vi.useFakeTimers();
    const store = createGameStore<FooState>("foo", INITIAL, 1);
    const sub = vi.fn();
    const unsub = store.subscribe(sub);

    store.set((s) => ({ ...s, count: s.count + 1 }));
    expect(store.get().count).toBe(1);
    expect(sub).toHaveBeenCalledTimes(1);
    // before debounce — not yet flushed
    expect(window.localStorage.getItem("phonara.gamestate.foo.v1")).toBeNull();

    // advance past 80ms debounce
    vi.advanceTimersByTime(100);
    const raw = window.localStorage.getItem("phonara.gamestate.foo.v1");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).count).toBe(1);

    unsub();
  });

  it("unsubscribe stops notifications without affecting state", () => {
    const store = createGameStore<FooState>("foo", INITIAL, 1);
    const sub = vi.fn();
    const unsub = store.subscribe(sub);
    store.set({ count: 5, label: "x" });
    expect(sub).toHaveBeenCalledTimes(1);
    unsub();
    store.set({ count: 6, label: "y" });
    expect(sub).toHaveBeenCalledTimes(1);
    expect(store.get().count).toBe(6);
  });
});

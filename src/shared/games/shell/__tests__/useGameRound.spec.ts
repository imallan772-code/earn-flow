/**
 * useGameRound spec — phase 전이 (single-step + multi-step + reset).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGameRound } from "../useGameRound";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useGameRound — single-step", () => {
  it("place() → rolling → settled → idle (happy path)", () => {
    const { result } = renderHook(() => useGameRound({ rollingMs: 100, settledMs: 100 }));
    expect(result.current.phase).toBe("idle");

    act(() => {
      const ok = result.current.place();
      expect(ok).toBe(true);
    });
    expect(result.current.phase).toBe("rolling");
    expect(result.current.isActive).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.phase).toBe("settled");
    expect(result.current.isSettled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.phase).toBe("idle");
    expect(result.current.isIdle).toBe(true);
  });

  it("place() while not idle returns false (loss path = same transitions)", () => {
    const { result } = renderHook(() => useGameRound({ rollingMs: 100, settledMs: 100 }));
    act(() => {
      result.current.place();
    });
    // try double-place
    let ok = true;
    act(() => {
      ok = result.current.place();
    });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("rolling");

    // still completes normally
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.phase).toBe("settled");
  });
});

describe("useGameRound — multi-step", () => {
  it("place() → playing → settle() → settled → idle", () => {
    const { result } = renderHook(() => useGameRound({ isMultiStep: true, settledMs: 100 }));

    act(() => {
      result.current.place();
    });
    expect(result.current.phase).toBe("playing");

    // auto transition NOT triggered (multi-step waits for external settle)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.phase).toBe("playing");

    act(() => {
      result.current.settle();
    });
    expect(result.current.phase).toBe("settled");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.phase).toBe("idle");
  });

  it("reset() returns to idle from any phase", () => {
    const { result } = renderHook(() => useGameRound({ isMultiStep: true, settledMs: 100 }));
    act(() => {
      result.current.place();
    });
    expect(result.current.phase).toBe("playing");

    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe("idle");
  });
});

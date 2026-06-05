import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  DESKTOP_LAYOUT_MEDIA_QUERY,
  DESKTOP_LAYOUT_MIN_WIDTH,
  useDesktopLayout,
} from "../useDesktopLayout";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matches && query === DESKTOP_LAYOUT_MEDIA_QUERY,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
}

describe("useDesktopLayout", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("exports 1024 SSOT constant", () => {
    expect(DESKTOP_LAYOUT_MIN_WIDTH).toBe(1024);
    expect(DESKTOP_LAYOUT_MEDIA_QUERY).toBe("(min-width: 1024px)");
  });

  it("returns true when matchMedia matches desktop", async () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useDesktopLayout());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("returns false when matchMedia is below desktop", async () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useDesktopLayout());
    await waitFor(() => expect(result.current).toBe(false));
  });
});

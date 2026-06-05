import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHotkeys } from "../useHotkeys";

describe("useHotkeys", () => {
  it("ignores keys when input is focused", () => {
    const fn = vi.fn();
    renderHook(() => useHotkeys({ " ": fn }));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const e = new KeyboardEvent("keydown", { key: " ", bubbles: true });
    Object.defineProperty(e, "target", { value: input });
    window.dispatchEvent(e);

    expect(fn).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("fires handler when not in editable target", () => {
    const fn = vi.fn();
    renderHook(() => useHotkeys({ " ": fn }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

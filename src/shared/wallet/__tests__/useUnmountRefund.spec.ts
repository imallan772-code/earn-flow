import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnmountRefund, type PendingRefund } from "../useUnmountRefund";

describe("useUnmountRefund", () => {
  it("does not call refund when pending is null", () => {
    const refund = vi.fn().mockResolvedValue(true);
    const { unmount } = renderHook(() => useUnmountRefund(refund, () => null));
    unmount();
    expect(refund).not.toHaveBeenCalled();
  });

  it("calls refund once with meta on unmount when pending set", () => {
    const refund = vi.fn().mockResolvedValue(true);
    const pending: PendingRefund = {
      amount: 5,
      meta: { game: "crash", roundId: "n7" },
    };
    const { unmount } = renderHook(() => useUnmountRefund(refund, () => pending));
    unmount();
    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund).toHaveBeenCalledWith(5, { game: "crash", roundId: "n7" });
  });

  it("swallows refund rejections (fire-and-forget)", async () => {
    const refund = vi.fn().mockRejectedValue(new Error("boom"));
    const pending: PendingRefund = {
      amount: 3,
      meta: { game: "mines", roundId: "n1" },
    };
    const { unmount } = renderHook(() => useUnmountRefund(refund, () => pending));
    expect(() => unmount()).not.toThrow();
    await Promise.resolve();
    expect(refund).toHaveBeenCalledTimes(1);
  });
});

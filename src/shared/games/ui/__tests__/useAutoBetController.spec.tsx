import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutoBetController } from "../useAutoBetController";

describe("useAutoBetController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places first bet on startAuto when autoCanPlace is true", async () => {
    const onPlace = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useAutoBetController({
        canPlace: true,
        autoCanPlace: true,
        hasActiveBet: false,
        balance: 100,
        amount: 10,
        target: 2,
        minBet: 0.01,
        bettingRoundKey: 0,
        onPlace,
      }),
    );

    await act(async () => {
      result.current.startAuto();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith(10, 2);
  });

  it("chains next bet after outcome when autoCanPlace opens (Plinko idle gate)", async () => {
    const onPlace = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
      (props: {
        autoCanPlace: boolean;
        lastOutcome: { outcome: "win" | "loss"; profit: number; nonce: number } | null;
        bettingRoundKey: number;
      }) =>
        useAutoBetController({
          canPlace: true,
          autoCanPlace: props.autoCanPlace,
          hasActiveBet: false,
          balance: 100,
          amount: 10,
          target: 2,
          minBet: 0.01,
          lastOutcome: props.lastOutcome,
          bettingRoundKey: props.bettingRoundKey,
          onPlace,
        }),
      {
        initialProps: {
          autoCanPlace: true,
          lastOutcome: null as { outcome: "win" | "loss"; profit: number; nonce: number } | null,
          bettingRoundKey: 0,
        },
      },
    );

    await act(async () => {
      result.current.startAuto();
      await Promise.resolve();
    });
    expect(onPlace).toHaveBeenCalledTimes(1);

    // Round in flight — auto gate closed (manual queue may still accept bets).
    rerender({ autoCanPlace: false, lastOutcome: null, bettingRoundKey: 1 });

    // Outcome while still not idle — controller waits.
    rerender({
      autoCanPlace: false,
      lastOutcome: { outcome: "loss", profit: -10, nonce: 0 },
      bettingRoundKey: 1,
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(onPlace).toHaveBeenCalledTimes(1);

    // Idle — second auto bet fires.
    rerender({
      autoCanPlace: true,
      lastOutcome: { outcome: "loss", profit: -10, nonce: 0 },
      bettingRoundKey: 1,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(onPlace).toHaveBeenCalledTimes(2);
  });

  it("does not auto-place when balance is below minBet", async () => {
    const onPlace = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useAutoBetController({
        canPlace: true,
        autoCanPlace: true,
        hasActiveBet: false,
        balance: 0.004,
        amount: 10,
        target: 2,
        minBet: 0.01,
        bettingRoundKey: 0,
        onPlace,
      }),
    );

    await act(async () => {
      result.current.startAuto();
      await Promise.resolve();
    });

    expect(onPlace).not.toHaveBeenCalled();
    expect(result.current.autoRunning).toBe(false);
  });
});

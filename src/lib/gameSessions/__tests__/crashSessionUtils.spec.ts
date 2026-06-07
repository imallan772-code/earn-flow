import { describe, expect, it } from "vitest";
import { activeCrashRoundFromSession } from "@/lib/gameSessions/crashSessionUtils";
import type { GameSessionRow } from "@/lib/gameSessions/schemas";

describe("activeCrashRoundFromSession", () => {
  it("hydrates server-side round without exposing crash point", () => {
    const row: GameSessionRow = {
      session_id: "00000000-0000-4000-8000-000000000001",
      game: "crash",
      round_id: "n42",
      bet_amount: 0,
      status: "active",
      client_state: {
        nonce: 42,
        stake_amount: 10,
        auto_target_e6: 2_000_000,
        started_at_ms: 1_700_000_000_000,
        bet_mode: "demo",
      },
    };
    const ar = activeCrashRoundFromSession(row, { autoTarget: 2 });
    expect(ar.serverSide).toBe(true);
    expect(ar.nonce).toBe(42);
    expect(ar.amount).toBe(10);
    expect(ar.autoTarget).toBe(2);
    expect(ar.startedAt).toBe(1_700_000_000_000);
    expect(ar.crashPoint).toBe(Number.POSITIVE_INFINITY);
    expect(ar.betMode).toBe("demo");
  });
});

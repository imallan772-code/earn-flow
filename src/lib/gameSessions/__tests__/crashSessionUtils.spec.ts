import { describe, expect, it } from "vitest";
import {
  activeCrashRoundFromSession,
  crashPlaceErrorMessage,
  formatCrashMultiplier,
  isCrashPermanentCashoutError,
  isCrashSessionNotFound,
  isKillSwitchActive,
  normalizeCrashPoint,
  persistCrashPoint,
  serverCrashRoundId,
} from "@/lib/gameSessions/crashSessionUtils";
import type { GameSessionRow } from "@/lib/gameSessions/schemas";

describe("normalizeCrashPoint", () => {
  it("maps null/0 to Infinity for server-side unknown bust point", () => {
    expect(normalizeCrashPoint(null, true)).toBe(Number.POSITIVE_INFINITY);
    expect(normalizeCrashPoint(0, true)).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps finite crash points", () => {
    expect(normalizeCrashPoint(2.45, true)).toBe(2.45);
    expect(normalizeCrashPoint(2.45, false)).toBe(2.45);
  });

  it("defaults client-side unknown to 1.0", () => {
    expect(normalizeCrashPoint(null, false)).toBe(1);
  });
});

describe("persistCrashPoint", () => {
  it("stores 0 instead of Infinity for JSON-safe server rounds", () => {
    expect(persistCrashPoint(Number.POSITIVE_INFINITY, true)).toBe(0);
    expect(persistCrashPoint(3.2, true)).toBe(3.2);
  });
});

describe("formatCrashMultiplier", () => {
  it("never throws on null crash point", () => {
    expect(formatCrashMultiplier(null, true)).toBe("—");
    expect(formatCrashMultiplier(2.5, true)).toBe("2.50x");
  });
});

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

describe("isCrashSessionNotFound", () => {
  it("detects P0002 and message variants", () => {
    expect(isCrashSessionNotFound({ code: "P0002", message: "CRASH_SESSION_NOT_FOUND" })).toBe(
      true,
    );
    expect(isCrashSessionNotFound({ message: "CRASH_SESSION_NOT_FOUND" })).toBe(true);
    expect(isCrashSessionNotFound({ message: "network" })).toBe(false);
  });
});

describe("serverCrashRoundId", () => {
  it("returns n-prefixed nonce only for server-side rounds with open bet", () => {
    expect(serverCrashRoundId({ serverSide: true, nonce: 12 })).toBe("n12");
    expect(serverCrashRoundId({ serverSide: true, nonce: 12 }, false)).toBeNull();
    expect(serverCrashRoundId({ serverSide: false, nonce: 12 })).toBeNull();
    expect(serverCrashRoundId(null)).toBeNull();
  });
});

describe("crashPlaceErrorMessage", () => {
  it("maps known RPC errors to user-facing copy", () => {
    expect(crashPlaceErrorMessage({ message: "KILL_SWITCH_ACTIVE" })).toContain("점검");
    expect(crashPlaceErrorMessage({ message: "CRASH_ACTIVE_SESSION" })).toContain("진행 중");
    expect(crashPlaceErrorMessage({ message: "CRASH_SESSION_NOT_FOUND" })).toContain("만료");
    expect(crashPlaceErrorMessage({ message: "MONEY_INSUFFICIENT_BALANCE" })).toContain("잔액");
  });
});

describe("isKillSwitchActive", () => {
  it("detects kill switch exception text", () => {
    expect(isKillSwitchActive({ message: "KILL_SWITCH_ACTIVE" })).toBe(true);
    expect(isKillSwitchActive({ message: "network" })).toBe(false);
  });
});

describe("isCrashPermanentCashoutError", () => {
  it("groups non-retryable cashout failures", () => {
    expect(isCrashPermanentCashoutError({ message: "CRASH_ALREADY_BUSTED" })).toBe(true);
    expect(isCrashPermanentCashoutError({ message: "CRASH_ALREADY_CASHED" })).toBe(true);
    expect(isCrashPermanentCashoutError({ message: "timeout" })).toBe(false);
  });
});

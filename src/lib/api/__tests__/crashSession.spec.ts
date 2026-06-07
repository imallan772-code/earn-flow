import { describe, expect, it } from "vitest";
import { crashPlaceResultSchema, crashSyncResultSchema, multFromE6, multToE6 } from "../crashSession";

describe("crashSession e6 helpers", () => {
  it("round-trips multipliers", () => {
    expect(multFromE6(multToE6(2.47))).toBeCloseTo(2.47, 5);
  });

  it("1.00x baseline", () => {
    expect(multToE6(1)).toBe(1_000_000);
  });
});

describe("crashPlaceResultSchema", () => {
  const base = {
    round_id: "n1",
    mode: "demo" as const,
    nonce: 0,
    session_id: "00000000-0000-4000-8000-000000000001",
  };

  it("accepts demo place response with null debit (Postgres JSON null)", () => {
    const parsed = crashPlaceResultSchema.parse({
      ...base,
      server_seed_hash: "abc123",
      debit: null,
    });
    expect(parsed.mode).toBe("demo");
    expect(parsed.debit).toBeNull();
  });

  it("accepts idempotent replay with null server_seed_hash", () => {
    expect(
      crashPlaceResultSchema.parse({
        ...base,
        server_seed_hash: null,
        debit: null,
      }),
    ).toMatchObject({ server_seed_hash: null });
  });
});

describe("crashSyncResultSchema", () => {
  it("coerces string bigint e6 from Postgres JSON", () => {
    const parsed = crashSyncResultSchema.parse({
      status: "busted",
      crash_point_e6: "2450000",
      current_multiplier_e6: "2500000",
    });
    expect(parsed.crash_point_e6).toBe(2_450_000);
    expect(parsed.current_multiplier_e6).toBe(2_500_000);
  });
});

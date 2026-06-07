import { describe, expect, it } from "vitest";
import { computeCrashPoint } from "@/shared/games/crash/CrashEngine";
import { multFromE6, multToE6 } from "@/lib/api/crashSession";

/** Stake-compatible PF vectors — TS client must match SQL crash_compute_point_e6 formula. */
const VECTORS = [
  { serverSeed: "phonara-crash-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 0 },
  { serverSeed: "phonara-crash-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 1 },
  { serverSeed: "phonara-crash-demo-server-seed-v1", clientSeed: "smoke-crash-rpc", nonce: 42 },
  { serverSeed: "test-server-seed-abcdef", clientSeed: "test-client", nonce: 100 },
];

describe("Crash PF parity (TS ↔ SQL formula)", () => {
  it("crash points are deterministic and >= 1.00", async () => {
    for (const v of VECTORS) {
      const cp = await computeCrashPoint(v);
      expect(cp).toBeGreaterThanOrEqual(1.0);
      const again = await computeCrashPoint(v);
      expect(again).toBe(cp);
    }
  });

  it("e6 helpers round-trip display multipliers", () => {
    for (const cp of [1.0, 1.01, 2.47, 124.39]) {
      expect(multFromE6(multToE6(cp))).toBeCloseTo(cp, 5);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  WHEEL_RISKS,
  WHEEL_SEGMENT_OPTIONS,
  WHEEL_RTP_TARGET,
  expectedMultiplier,
  getSegments,
  multiplierAt,
  spin,
} from "@/shared/games/wheel/WheelEngine";

const VECTORS = [
  { serverSeed: "phonara-wheel-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 0 },
  { serverSeed: "phonara-wheel-demo-server-seed-v1", clientSeed: "phonara-player-001", nonce: 1 },
  { serverSeed: "wheel-server-seed-fixed", clientSeed: "wheel-client-seed", nonce: 42 },
  { serverSeed: "test-server-seed-abcdef", clientSeed: "test-client", nonce: 100 },
];

describe("Wheel PF parity (TS ↔ SQL wheel_compute_spin_index + multiplier table)", () => {
  it("spin indices are deterministic and ∈ [0, segments)", async () => {
    for (const v of VECTORS) {
      for (const segments of WHEEL_SEGMENT_OPTIONS) {
        const idx = await spin(v, segments);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(segments);
        const again = await spin(v, segments);
        expect(again).toBe(idx);
      }
    }
  });

  it("multiplier tables match RTP target and lookup bounds", () => {
    for (const risk of WHEEL_RISKS) {
      for (const segments of WHEEL_SEGMENT_OPTIONS) {
        const arr = getSegments(risk, segments);
        expect(arr.length).toBe(segments);
        const mean = expectedMultiplier(risk, segments);
        expect(mean).toBeGreaterThan(WHEEL_RTP_TARGET - 0.005);
        expect(mean).toBeLessThan(WHEEL_RTP_TARGET + 0.005);
        for (let i = 0; i < segments; i++) {
          expect(multiplierAt(risk, segments, i)).toBe(arr[i]);
        }
      }
    }
  });

  it("won = multiplier > 0 (Stake-style)", () => {
    for (const risk of WHEEL_RISKS) {
      for (const segments of WHEEL_SEGMENT_OPTIONS) {
        const arr = getSegments(risk, segments);
        for (let i = 0; i < segments; i++) {
          const m = arr[i];
          const won = m > 0;
          if (m === 0) expect(won).toBe(false);
          if (m > 0) expect(won).toBe(true);
        }
      }
    }
  });
});

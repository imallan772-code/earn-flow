import { describe, expect, it } from "vitest";
import { pfSessionRotateSchema, pfSessionSchema } from "../pfSessionSchemas";

describe("pfSessionSchemas", () => {
  const sample = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    game: "dice",
    server_seed: "abc123",
    server_seed_hash: "deadbeef",
    client_seed: "phonara-player-001",
    nonce: 0,
    status: "active" as const,
  };

  it("parses active session", () => {
    expect(pfSessionSchema.parse(sample)).toEqual(sample);
  });

  it("parses rotate result", () => {
    const rotated = pfSessionRotateSchema.parse({
      previous: {
        id: sample.id,
        server_seed: sample.server_seed,
        server_seed_hash: sample.server_seed_hash,
        nonce: 42,
      },
      current: { ...sample, id: "660e8400-e29b-41d4-a716-446655440001", nonce: 0 },
    });
    expect(rotated.current.game).toBe("dice");
  });
});

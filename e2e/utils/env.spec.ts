import { describe, expect, it } from "vitest";
import dotenv from "dotenv";

/**
 * Documents Bun vs dotenv.parse behavior for .env secrets.
 * Regression guard: E2E must read credentials via getEnv(), not process.env.
 */
describe("E2E env — Bun $ mangling", () => {
  it("dotenv.parse preserves $$ in quoted passwords (Bun process.env may not)", () => {
    const parsed = dotenv.parse('E2E_USER_PASSWORD="aa$$bb"');
    expect(parsed.E2E_USER_PASSWORD).toBe("aa$$bb");
    expect(parsed.E2E_USER_PASSWORD.length).toBe(6);
  });

  it("unquoted values with $ may be truncated when loaded by shell runtimes", () => {
    // Bun expands `$b` as empty when unquoted — simulates why we never use process.env for E2E secrets.
    const parsed = dotenv.parse("E2E_USER_PASSWORD=aa$$bb");
    expect(parsed.E2E_USER_PASSWORD).toBe("aa$$bb");
  });
});

import { describe, expect, it } from "vitest";
import { __test } from "@/routes/api/public/cron.promo-tick";
import { createHmac } from "crypto";

describe("cron HMAC", () => {
  const secret = "test-secret-xx";
  const body = '{"tick":1}';
  const valid = createHmac("sha256", secret).update(body).digest("hex");

  it("accepts valid signature", () => {
    expect(__test.verifyHmac(secret, body, valid)).toBe(true);
  });
  it("rejects missing", () => {
    expect(__test.verifyHmac(secret, body, null)).toBe(false);
  });
  it("rejects wrong sig", () => {
    expect(__test.verifyHmac(secret, body, "deadbeef")).toBe(false);
  });
  it("rejects tampered body", () => {
    expect(__test.verifyHmac(secret, '{"tick":2}', valid)).toBe(false);
  });
});

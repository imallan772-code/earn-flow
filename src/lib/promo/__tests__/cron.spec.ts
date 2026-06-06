import { describe, expect, it } from "vitest";
import { verifyPromoCronHmac } from "@/lib/promo/cronHmac";
import { createHmac } from "crypto";

describe("cron HMAC", () => {
  const secret = "test-secret-xx";
  const body = '{"tick":1}';
  const valid = createHmac("sha256", secret).update(body).digest("hex");

  it("accepts valid signature", () => {
    expect(verifyPromoCronHmac(secret, body, valid)).toBe(true);
  });
  it("rejects missing", () => {
    expect(verifyPromoCronHmac(secret, body, null)).toBe(false);
  });
  it("rejects wrong sig", () => {
    expect(verifyPromoCronHmac(secret, body, "deadbeef")).toBe(false);
  });
  it("rejects tampered body", () => {
    expect(verifyPromoCronHmac(secret, '{"tick":2}', valid)).toBe(false);
  });
});

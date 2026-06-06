import { describe, expect, it } from "vitest";
import { assertSafeUrl } from "@/lib/promo/ssrf";

describe("ssrf", () => {
  it("allows public https", () => {
    expect(() => assertSafeUrl("https://example.com/x")).not.toThrow();
  });
  it("blocks localhost", () => {
    expect(() => assertSafeUrl("http://localhost/x")).toThrow();
  });
  it("blocks 127.0.0.1", () => {
    expect(() => assertSafeUrl("http://127.0.0.1:8080")).toThrow();
  });
  it("blocks private 10.x", () => {
    expect(() => assertSafeUrl("http://10.0.0.5/")).toThrow();
  });
  it("blocks AWS metadata", () => {
    expect(() => assertSafeUrl("http://169.254.169.254/latest")).toThrow();
  });
  it("blocks file://", () => {
    expect(() => assertSafeUrl("file:///etc/passwd")).toThrow();
  });
  it("blocks .internal", () => {
    expect(() => assertSafeUrl("http://api.internal/")).toThrow();
  });
});

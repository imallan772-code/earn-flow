import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendWebhook, buildWebhookAdapter } from "@/lib/promo/channels/webhook";

describe("channels/webhook", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("blocks SSRF: localhost", async () => {
    const r = await sendWebhook("http://localhost:8080/h", { a: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SSRF_BLOCKED");
  });

  it("blocks SSRF: private IP 10.x", async () => {
    const r = await sendWebhook("http://10.0.0.5/h", { a: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SSRF_BLOCKED");
  });

  it("POSTs JSON for safe hostnames", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe("https://hooks.zapier.com/x");
        expect(init?.method).toBe("POST");
        return new Response("ok", { status: 200 });
      }),
    );
    const r = await sendWebhook("https://hooks.zapier.com/x", { foo: "bar" });
    expect(r.ok).toBe(true);
  });

  it("adapter verify returns CONFIG_MISSING without webhookUrl", async () => {
    const adapter = buildWebhookAdapter("zapier");
    const r = await adapter.verify({ settings: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CONFIG_MISSING");
  });
});

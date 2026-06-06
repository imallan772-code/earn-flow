import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const ORIG = { ...process.env };

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.LOVABLE_API_KEY;
  delete process.env.GEMINI_MODEL;
  vi.restoreAllMocks();
  vi.resetModules();
});

afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIG)) delete process.env[k];
  }
});

async function load() {
  return import("@/lib/promo/ai.server");
}

describe("ai.server.resolveProvider", () => {
  it("returns null when no keys", async () => {
    const { resolveProvider } = await load();
    expect(resolveProvider()).toBeNull();
  });
  it("prefers gemini-direct when GEMINI_API_KEY set", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.LOVABLE_API_KEY = "test-lovable";
    const { resolveProvider } = await load();
    const r = resolveProvider();
    expect(r?.provider).toBe("gemini-direct");
    expect(r?.model).toBe("gemini-2.5-flash");
  });
  it("falls back to lovable-gateway", async () => {
    process.env.LOVABLE_API_KEY = "test-lovable";
    const { resolveProvider } = await load();
    expect(resolveProvider()?.provider).toBe("lovable-gateway");
  });
  it("respects GEMINI_MODEL override", async () => {
    process.env.GEMINI_API_KEY = "k";
    process.env.GEMINI_MODEL = "gemini-2.5-flash-lite";
    const { resolveProvider } = await load();
    expect(resolveProvider()?.model).toBe("gemini-2.5-flash-lite");
  });
});

describe("ai.server.callPromoBundle", () => {
  it("AI_NOT_CONFIGURED when no key", async () => {
    const { callPromoBundle } = await load();
    const r = await callPromoBundle({
      brief: "test",
      title: "t",
      targetUrl: "https://e.com",
      channels: ["telegram"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("AI_NOT_CONFIGURED");
  });

  it("Direct Gemini: parses 200 JSON candidate text", async () => {
    process.env.GEMINI_API_KEY = "k";
    const payload = {
      brief: "정제",
      variants: [
        { channel: "telegram", body: "tg body", hashtags: ["#a"], cta: "go" },
        { channel: "x", body: "x body", hashtags: [], cta: "" },
      ],
      risk: { score: 12, flags: [] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toContain("generativelanguage.googleapis.com");
        expect(url).not.toContain("key=");
        expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
          }),
          { status: 200 },
        );
      }),
    );
    const { callPromoBundle } = await load();
    const r = await callPromoBundle({
      brief: "x",
      title: "",
      targetUrl: "",
      channels: ["telegram", "x"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider).toBe("gemini-direct");
      expect(r.data.variants).toHaveLength(2);
      expect(r.data.variants[0].channel).toBe("telegram");
    }
  });

  it("Gateway: parses OpenAI-style choices", async () => {
    process.env.LOVABLE_API_KEY = "lk";
    const payload = {
      brief: "ok",
      variants: [{ channel: "slack", body: "s", hashtags: [], cta: "" }],
      risk: { score: 0, flags: [] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toContain("ai.gateway.lovable.dev");
        expect((init?.headers as Record<string, string>).Authorization).toContain("Bearer");
        return new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
          { status: 200 },
        );
      }),
    );
    const { callPromoBundle } = await load();
    const r = await callPromoBundle({
      brief: "x",
      title: "",
      targetUrl: "",
      channels: ["slack"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.provider).toBe("lovable-gateway");
  });

  it("maps 429 to AI_RATE_LIMITED", async () => {
    process.env.GEMINI_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("limit", { status: 429 })));
    const { callPromoBundle } = await load();
    const r = await callPromoBundle({
      brief: "x",
      title: "",
      targetUrl: "",
      channels: ["telegram"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("AI_RATE_LIMITED");
  });

  it("maps 500 to AI_ERROR", async () => {
    process.env.GEMINI_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    const { callPromoBundle } = await load();
    const r = await callPromoBundle({
      brief: "x",
      title: "",
      targetUrl: "",
      channels: ["telegram"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("AI_ERROR");
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const ORIG = { ...process.env };

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_IMAGE_MODEL;
  vi.restoreAllMocks();
  vi.resetModules();
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in ORIG)) delete process.env[k];
});

async function load() {
  return import("@/lib/promo/image.server");
}

describe("image.server", () => {
  it("IMAGE_NOT_CONFIGURED without GEMINI_API_KEY", async () => {
    const { streamPromoImage } = await load();
    const r = await streamPromoImage("a cat");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("IMAGE_NOT_CONFIGURED");
  });

  it("rejects Flash text model (no image suffix) — SSOT", async () => {
    process.env.GEMINI_API_KEY = "k";
    process.env.GEMINI_IMAGE_MODEL = "gemini-2.5-flash";
    const { resolveImageProvider } = await load();
    expect(resolveImageProvider()).toBeNull();
  });

  it("returns base64 + mime on success", async () => {
    process.env.GEMINI_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { data: "AAAA", mimeType: "image/png" } }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const { streamPromoImage } = await load();
    const r = await streamPromoImage("hi");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.base64).toBe("AAAA");
      expect(r.data.mimeType).toBe("image/png");
    }
  });

  it("maps 429 to IMAGE_RATE_LIMITED", async () => {
    process.env.GEMINI_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("limit", { status: 429 })));
    const { streamPromoImage } = await load();
    const r = await streamPromoImage("x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("IMAGE_RATE_LIMITED");
  });
});

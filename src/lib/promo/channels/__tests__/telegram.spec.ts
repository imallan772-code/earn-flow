import { describe, expect, it, vi, beforeEach } from "vitest";
import { telegramAdapter, formatTelegramText } from "@/lib/promo/channels/telegram";
import type { PromoVariant } from "@/features/admin/promo/types";

const variant: PromoVariant = {
  id: "v1",
  channel: "telegram",
  body: "안녕 PHONARA",
  hashtags: ["#a", "#b"],
  cta: "go",
  weight: 1,
};

describe("channels/telegram", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("CONFIG_MISSING without token/chat", async () => {
    const r = await telegramAdapter.send({
      channel: "telegram",
      variant,
      targetUrl: "https://x.y",
      settings: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CONFIG_MISSING");
  });

  it("truncates body longer than max length", () => {
    const long = "x".repeat(5000);
    const t = formatTelegramText({ body: long });
    expect(t.length).toBeLessThanOrEqual(3800);
    expect(t.endsWith("…")).toBe(true);
  });

  it("posts to telegram api when configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toContain("api.telegram.org");
        expect(url).toContain("/sendMessage");
        return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), {
          status: 200,
        });
      }),
    );
    const r = await telegramAdapter.send({
      channel: "telegram",
      variant,
      targetUrl: "https://phonara.app",
      settings: { telegramBotToken: "abc", telegramChatId: "@phonara" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.externalId).toBe("42");
  });
});

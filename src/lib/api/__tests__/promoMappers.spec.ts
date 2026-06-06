import { describe, expect, it } from "vitest";
import { mapPromoSettingsRow, mapPromoVariantRow } from "@/lib/api/promo/mappers";

describe("promo mappers (Z-2 read-back)", () => {
  it("mapPromoVariantRow maps image_url to imageUrl", () => {
    const v = mapPromoVariantRow({
      id: "v1",
      channel: "telegram",
      body: "hello",
      hashtags: ["#a"],
      cta: "go",
      weight: 1,
      image_url: "https://cdn.example/hero.png",
      utm: { imagePrompt: "neon" },
    });
    expect(v.imageUrl).toBe("https://cdn.example/hero.png");
    expect(v.imagePrompt).toBe("neon");
  });

  it("mapPromoSettingsRow maps telegram fields from default_utm", () => {
    const s = mapPromoSettingsRow({
      webhookUrl: "https://hooks.example/h",
      hmacSecret: "secret",
      defaultUtmSource: "phonara",
      telegramBotToken: "123:ABC",
      telegramChatId: "@phonara",
    });
    expect(s.telegramBotToken).toBe("123:ABC");
    expect(s.telegramChatId).toBe("@phonara");
    expect(s.webhookUrl).toBe("https://hooks.example/h");
  });
});

/**
 * Telegram Bot API adapter — fixed URL (api.telegram.org), not SSRF-bound.
 * Token + chatId stored in promo_settings.default_utm JSON (no DB migration).
 */
import type { ChannelAdapter, ChannelResult, ChannelSendInput } from "./types";

const TG_BASE = "https://api.telegram.org";
const MAX_LEN = 3800; // Telegram sendMessage limit is 4096; reserve room

export function formatTelegramText(input: {
  body: string;
  hashtags?: string[];
  cta?: string;
  targetUrl?: string;
}): string {
  const parts: string[] = [input.body];
  if (input.hashtags && input.hashtags.length > 0) parts.push(input.hashtags.join(" "));
  if (input.cta) parts.push(input.cta);
  if (input.targetUrl) parts.push(input.targetUrl);
  const joined = parts.filter(Boolean).join("\n\n");
  return joined.length > MAX_LEN ? joined.slice(0, MAX_LEN - 1) + "…" : joined;
}

async function sendMessage(
  token: string,
  chatId: string,
  text: string,
  signal?: AbortSignal,
): Promise<ChannelResult> {
  try {
    const res = await fetch(`${TG_BASE}/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, code: "CHANNEL_ERROR", message: `${res.status}: ${txt.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
    };
    return { ok: true, externalId: String(json.result?.message_id ?? "") };
  } catch (e) {
    return { ok: false, code: "CHANNEL_ERROR", message: (e as Error)?.message };
  }
}

export const telegramAdapter: ChannelAdapter = {
  id: "telegram",
  async send({ variant, targetUrl, settings }: ChannelSendInput) {
    const token = settings.telegramBotToken;
    const chatId = settings.telegramChatId;
    if (!token || !chatId) {
      return { ok: false, code: "CONFIG_MISSING", message: "telegram token/chat missing" };
    }
    const text = formatTelegramText({
      body: variant.body,
      hashtags: variant.hashtags,
      cta: variant.cta,
      targetUrl,
    });
    return sendMessage(token, chatId, text);
  },
  async verify({ settings }) {
    const token = settings.telegramBotToken;
    if (!token) return { ok: false, code: "CONFIG_MISSING", message: "telegram token missing" };
    try {
      const res = await fetch(`${TG_BASE}/bot${encodeURIComponent(token)}/getMe`);
      if (!res.ok) return { ok: false, code: "CHANNEL_ERROR", message: `${res.status}` };
      return { ok: true, message: "bot ok" };
    } catch (e) {
      return { ok: false, code: "CHANNEL_ERROR", message: (e as Error)?.message };
    }
  },
};

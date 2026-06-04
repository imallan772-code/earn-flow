/**
 * t(key, params?) — type-safe message lookup with {placeholder} interpolation.
 *
 * Add a new locale by:
 *   1. Creating messages.<lang>.ts mirroring messages_ko's keys.
 *   2. Adding the lang to Locale union in locale.ts.
 *   3. Registering it in CATALOGS below.
 */
import { getLocale, type Locale } from "./locale";
import { messages_ko } from "./messages.ko";
import { messages_en } from "./messages.en";
import type { MessageKey, MessageParams } from "./types";

const CATALOGS: Record<Locale, Record<MessageKey, string>> = {
  ko: messages_ko,
  en: messages_en,
};

export function t(key: MessageKey, params?: MessageParams): string {
  const catalog = CATALOGS[getLocale()] ?? messages_ko;
  const template = catalog[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, p) => {
    const v = params[p];
    return v === undefined ? `{${p}}` : String(v);
  });
}

export { getLocale, setLocale, subscribeLocale } from "./locale";
export type { Locale } from "./locale";
export type { MessageKey, MessageParams } from "./types";

import type { messages_ko } from "./messages.ko";

export type MessageKey = keyof typeof messages_ko;
export type MessageParams = Record<string, string | number>;

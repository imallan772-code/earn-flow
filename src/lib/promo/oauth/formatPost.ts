import type { PromoVariant } from "@/features/admin/promo/types";

const X_MAX = 280;

export function formatChannelPostText(input: {
  variant: PromoVariant;
  targetUrl: string;
  maxLen?: number;
}): string {
  const parts: string[] = [input.variant.body.trim()];
  if (input.variant.hashtags?.length) parts.push(input.variant.hashtags.join(" "));
  if (input.variant.cta) parts.push(input.variant.cta);
  if (input.targetUrl) parts.push(input.targetUrl);
  const joined = parts.filter(Boolean).join("\n\n");
  const max = input.maxLen ?? 3000;
  return joined.length > max ? joined.slice(0, max - 1) + "…" : joined;
}

export function formatXPostText(variant: PromoVariant, targetUrl: string): string {
  return formatChannelPostText({ variant, targetUrl, maxLen: X_MAX });
}

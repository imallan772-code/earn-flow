/**
 * AI 미연결 / 호출 실패 시 사용하는 로컬 fallback variants.
 * 순수함수 — Studio + 테스트에서 reuse.
 */
import { PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";
import type { PromoChannelId, PromoVariant } from "@/features/admin/promo/types";

export function buildFallbackVariants(
  brief: string,
  channels: PromoChannelId[],
): PromoVariant[] {
  const snippet = brief.trim().slice(0, 80) || "PHONARA 신규 캠페인";
  const ts = Date.now();
  return channels.map((ch, i) => ({
    id: `fb-${ts}-${i}`,
    channel: ch,
    body: `[${PROMO_CHANNEL_LABELS_KO[ch] ?? ch}] ${snippet}`,
    hashtags: ["#phonara", "#프로모"],
    cta: "지금 가입",
    weight: 1,
    imagePrompt: undefined,
  }));
}

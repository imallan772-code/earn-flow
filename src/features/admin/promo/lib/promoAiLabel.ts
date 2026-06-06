import { ADMIN_KO } from "@/shared/admin/labels.ko";
import type { PromoAiProvider } from "@/lib/promo/ai.server";

const ko = ADMIN_KO.promo.ai;

export function promoAiProviderLabelKo(provider: PromoAiProvider | null | undefined): string {
  switch (provider) {
    case "openrouter":
      return ko.providerOpenRouter;
    case "gemini-direct":
      return ko.providerGemini;
    case "lovable-gateway":
      return ko.providerGateway;
    default:
      return ko.notConfigured;
  }
}

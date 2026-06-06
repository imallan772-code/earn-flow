/**
 * Phase Z-0 — server fn stubs only.
 * 실 dispatch · AI 호출 · DB write 없음. Z-1에서 multi-fn (composePromoBrief / Variants / scanPromoRisk / translate) 분리 구현.
 * server in-memory store 절대 금지 (`new Map()` / module-level `let arr=[]` 금지).
 */
import { createServerFn } from "@tanstack/react-start";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { promoListAssets, promoListCampaigns, promoListDispatches } from "@/lib/api/promo";

const NOT_IMPLEMENTED = "Phase Z-0 stub — Z-1에서 구현";

export const composePromo = createServerFn({ method: "POST" })
  .inputValidator((d: { brief: string; targetUrl: string }) => d)
  .handler(async () => {
    throw new Error(NOT_IMPLEMENTED);
  });

export const publishCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: { campaignId: string }) => d)
  .handler(async () => {
    throw new Error(NOT_IMPLEMENTED);
  });

export const testChannel = createServerFn({ method: "POST" })
  .inputValidator((d: { channel: string }) => d)
  .handler(async () => {
    throw new Error(NOT_IMPLEMENTED);
  });

export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return { campaigns: [] as string[] };
  const campaigns = await promoListCampaigns();
  return { campaigns };
});

export const listDispatches = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return { dispatches: [] as string[] };
  const dispatches = await promoListDispatches();
  return { dispatches };
});

export const listAssets = createServerFn({ method: "GET" }).handler(async () => {
  if (!isSupabaseConfigured()) return { assets: [] as string[] };
  const assets = await promoListAssets();
  return { assets };
});

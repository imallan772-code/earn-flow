/**
 * Promo admin data — Supabase RPC when configured, else client mockStore.
 * Pattern: AdminNotice (lib/api + TanStack Query + mock fallback).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import {
  promoAnalyticsSummary,
  promoDeleteCampaign,
  promoGetSettings,
  promoListAssets,
  promoListCampaigns,
  promoListDispatches,
  promoRecordDispatch,
  promoUpsertAsset,
  promoUpsertCampaign,
  promoUpsertSettings,
} from "@/lib/api/promo";
import { promoMockStore, usePromoState } from "../store/mockStore";
import { campaignToUpsertPayload } from "../lib/mapCampaign";
import type {
  PromoAsset,
  PromoCampaign,
  PromoChannelId,
  PromoDispatch,
  PromoSettings,
  PromoVariant,
} from "../types";

export const PROMO_QUERY_KEYS = {
  campaigns: ["admin", "promo", "campaigns"] as const,
  dispatches: ["admin", "promo", "dispatches"] as const,
  assets: ["admin", "promo", "assets"] as const,
  settings: ["admin", "promo", "settings"] as const,
  analytics: ["admin", "promo", "analytics"] as const,
};

export function usePromoAdmin() {
  const configured = isSupabaseConfigured();
  const qc = useQueryClient();

  const mockCampaigns = usePromoState((s) => s.campaigns);
  const mockDispatches = usePromoState((s) => s.dispatches);
  const mockAssets = usePromoState((s) => s.assets);
  const mockSettings = usePromoState((s) => s.settings);
  const mockClicks = usePromoState((s) => s.clicks);

  const campaignsQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.campaigns,
    queryFn: promoListCampaigns,
    enabled: configured,
  });
  const dispatchesQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.dispatches,
    queryFn: () => promoListDispatches(),
    enabled: configured,
  });
  const assetsQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.assets,
    queryFn: promoListAssets,
    enabled: configured,
  });
  const settingsQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.settings,
    queryFn: promoGetSettings,
    enabled: configured,
  });
  const analyticsQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.analytics,
    queryFn: promoAnalyticsSummary,
    enabled: configured,
  });

  const campaigns =
    configured && campaignsQuery.data ? campaignsQuery.data : mockCampaigns;
  const dispatches =
    configured && dispatchesQuery.data ? dispatchesQuery.data : mockDispatches;
  const assets = configured && assetsQuery.data ? assetsQuery.data : mockAssets;
  const settings =
    configured && settingsQuery.data ? settingsQuery.data : mockSettings;

  const invalidateAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.campaigns }),
      qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.dispatches }),
      qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.analytics }),
    ]);
  };

  const upsertCampaignMut = useMutation({
    mutationFn: (c: PromoCampaign) => promoUpsertCampaign(campaignToUpsertPayload(c)),
    onSuccess: invalidateAll,
  });

  const deleteCampaignMut = useMutation({
    mutationFn: (id: string) => promoDeleteCampaign(id),
    onSuccess: invalidateAll,
  });

  const upsertSettingsMut = useMutation({
    mutationFn: async (patch: Partial<PromoSettings>) => {
      const current =
        qc.getQueryData<PromoSettings>(PROMO_QUERY_KEYS.settings) ?? {
          webhookUrl: "",
          hmacSecret: "",
          defaultUtmSource: "phonara-promo",
        };
      return promoUpsertSettings({
        default_utm: {
          webhookUrl: patch.webhookUrl ?? current.webhookUrl,
          hmacSecret: patch.hmacSecret ?? current.hmacSecret,
          defaultUtmSource: patch.defaultUtmSource ?? current.defaultUtmSource,
          utm_source: patch.defaultUtmSource ?? current.defaultUtmSource,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.settings }),
  });

  const addAssetMut = useMutation({
    mutationFn: (a: Omit<PromoAsset, "createdAt"> & { createdAt?: string }) =>
      promoUpsertAsset({
        id: a.id,
        kind: a.kind,
        url: a.url,
        alt: a.alt,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.assets }),
  });

  const recordDispatchMut = useMutation({
    mutationFn: (d: Omit<PromoDispatch, "id" | "sentAt"> & { sentAt?: string }) =>
      promoRecordDispatch({
        campaignId: d.campaignId,
        variantId: d.variantId,
        channel: d.channel,
        status: d.status,
        error: d.error,
        sentAt: d.sentAt,
      }),
    onSuccess: invalidateAll,
  });

  const upsertCampaign = (c: PromoCampaign) => {
    if (configured) {
      upsertCampaignMut.mutate(c);
      return;
    }
    promoMockStore.upsertCampaign(c);
  };

  const removeCampaign = (id: string) => {
    if (configured) {
      deleteCampaignMut.mutate(id);
      return;
    }
    promoMockStore.removeCampaign(id);
  };

  const scheduleCampaign = (id: string, iso: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    const next: PromoCampaign = { ...c, scheduledAt: iso, status: "scheduled" };
    upsertCampaign(next);
  };

  const addDispatch = (d: PromoDispatch) => {
    if (configured) {
      recordDispatchMut.mutate(d);
      return;
    }
    promoMockStore.addDispatch(d);
  };

  const updateSettings = (patch: Partial<PromoSettings>) => {
    if (configured) {
      upsertSettingsMut.mutate(patch);
      return;
    }
    promoMockStore.updateSettings(patch);
  };

  const addAsset = (a: PromoAsset) => {
    if (configured) {
      addAssetMut.mutate(a);
      return;
    }
    promoMockStore.addAsset(a);
  };

  const analytics = configured && analyticsQuery.data
    ? {
        impressions: analyticsQuery.data.sent * 100,
        clicks: analyticsQuery.data.clicks,
        dispatches: analyticsQuery.data.sent,
        campaigns: analyticsQuery.data.campaigns,
        topChannel: analyticsQuery.data.top_channel,
      }
    : {
        impressions: mockDispatches.length * 100,
        clicks: mockClicks.length,
        dispatches: mockDispatches.length,
        campaigns: mockCampaigns.length,
        topChannel: null as string | null,
      };

  const loading =
    configured &&
    (campaignsQuery.isLoading ||
      dispatchesQuery.isLoading ||
      assetsQuery.isLoading ||
      settingsQuery.isLoading);

  return {
    configured,
    loading,
    campaigns,
    dispatches,
    assets,
    settings,
    analytics,
    upsertCampaign,
    removeCampaign,
    scheduleCampaign,
    addDispatch,
    updateSettings,
    addAsset,
    isSaving:
      upsertCampaignMut.isPending ||
      deleteCampaignMut.isPending ||
      upsertSettingsMut.isPending ||
      addAssetMut.isPending ||
      recordDispatchMut.isPending,
  };
}

export type { PromoChannelId, PromoVariant };

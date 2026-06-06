/**
 * Promo admin data — Supabase RPC when configured, else client mockStore.
 * Pattern: AdminNotice (lib/api + TanStack Query + mock fallback).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { fetchIsAdmin } from "@/lib/api/admin/auth";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import {
  promoAnalyticsSummary,
  promoDeleteCampaign,
  promoGetSettings,
  promoListAssets,
  promoListCampaigns,
  promoListClicks,
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
  PromoClick,
  PromoDispatch,
  PromoSettings,
  PromoVariant,
} from "../types";

export const PROMO_QUERY_KEYS = {
  campaigns: ["admin", "promo", "campaigns"] as const,
  dispatches: ["admin", "promo", "dispatches"] as const,
  clicks: ["admin", "promo", "clicks"] as const,
  assets: ["admin", "promo", "assets"] as const,
  settings: ["admin", "promo", "settings"] as const,
  analytics: ["admin", "promo", "analytics"] as const,
};

export function usePromoAdmin() {
  const configured = isSupabaseConfigured();
  const { status } = useAuth();
  const qc = useQueryClient();

  const adminMembership = useQuery({
    queryKey: ["admin", "membership"],
    queryFn: fetchIsAdmin,
    enabled: configured && status === "authenticated",
    retry: false,
    staleTime: 5 * 60_000,
  });

  /** Supabase RPC — only when logged-in admin_users member (stops 400 spam in dev-open). */
  const persisting =
    configured && status === "authenticated" && adminMembership.data === true;

  const mockCampaigns = usePromoState((s) => s.campaigns);
  const mockDispatches = usePromoState((s) => s.dispatches);
  const mockAssets = usePromoState((s) => s.assets);
  const mockSettings = usePromoState((s) => s.settings);
  const mockClicks = usePromoState((s) => s.clicks);

  const campaignsQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.campaigns,
    queryFn: promoListCampaigns,
    enabled: persisting,
    retry: false,
  });
  const dispatchesQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.dispatches,
    queryFn: () => promoListDispatches(),
    enabled: persisting,
    retry: false,
  });
  const clicksQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.clicks,
    queryFn: () => promoListClicks(),
    enabled: persisting,
    retry: false,
  });
  const assetsQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.assets,
    queryFn: promoListAssets,
    enabled: persisting,
    retry: false,
  });
  const settingsQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.settings,
    queryFn: promoGetSettings,
    enabled: persisting,
    retry: false,
  });
  const analyticsQuery = useQuery({
    queryKey: PROMO_QUERY_KEYS.analytics,
    queryFn: () => promoAnalyticsSummary(),
    enabled: persisting,
    retry: false,
  });

  const queriesPending =
    persisting &&
    (campaignsQuery.isLoading ||
      dispatchesQuery.isLoading ||
      clicksQuery.isLoading ||
      assetsQuery.isLoading ||
      settingsQuery.isLoading ||
      analyticsQuery.isLoading);

  const campaigns = persisting
    ? queriesPending
      ? []
      : (campaignsQuery.data ?? [])
    : mockCampaigns;
  const dispatches = persisting
    ? queriesPending
      ? []
      : (dispatchesQuery.data ?? [])
    : mockDispatches;
  const clicks: PromoClick[] = persisting
    ? queriesPending
      ? []
      : (clicksQuery.data ?? [])
    : mockClicks;
  const assets = persisting
    ? queriesPending
      ? []
      : (assetsQuery.data ?? [])
    : mockAssets;
  const settings = persisting
    ? (settingsQuery.data ?? {
        webhookUrl: "",
        hmacSecret: "",
        defaultUtmSource: "phonara-promo",
      })
    : mockSettings;

  const invalidateAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.campaigns }),
      qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.dispatches }),
      qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.clicks }),
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
      const next = { ...current, ...patch };
      return promoUpsertSettings({
        default_utm: {
          webhookUrl: next.webhookUrl,
          hmacSecret: next.hmacSecret,
          defaultUtmSource: next.defaultUtmSource,
          utm_source: next.defaultUtmSource,
          telegramBotToken: next.telegramBotToken ?? "",
          telegramChatId: next.telegramChatId ?? "",
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
    if (persisting) {
      upsertCampaignMut.mutate(c);
      return;
    }
    promoMockStore.upsertCampaign(c);
  };

  const removeCampaign = (id: string) => {
    if (persisting) {
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
    if (persisting) {
      recordDispatchMut.mutate(d);
      return;
    }
    promoMockStore.addDispatch(d);
  };

  const updateSettings = (patch: Partial<PromoSettings>) => {
    if (persisting) {
      upsertSettingsMut.mutate(patch);
      return;
    }
    promoMockStore.updateSettings(patch);
  };

  const addAsset = (a: PromoAsset) => {
    if (persisting) {
      addAssetMut.mutate(a);
      return;
    }
    promoMockStore.addAsset(a);
  };

  const analytics = persisting
    ? queriesPending || !analyticsQuery.data
      ? {
          impressions: 0,
          clicks: 0,
          dispatches: 0,
          campaigns: 0,
          topChannel: null as string | null,
        }
      : {
          impressions: analyticsQuery.data.sent * 100,
          clicks: analyticsQuery.data.clicks,
          dispatches: analyticsQuery.data.sent,
          campaigns: analyticsQuery.data.campaigns,
          topChannel: analyticsQuery.data.top_channel ?? null,
        }
    : {
        impressions: mockDispatches.length * 100,
        clicks: mockClicks.length,
        dispatches: mockDispatches.length,
        campaigns: mockCampaigns.length,
        topChannel: null as string | null,
      };

  const loading = queriesPending;

  return {
    configured,
    persisting,
    loading,
    campaigns,
    dispatches,
    clicks,
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

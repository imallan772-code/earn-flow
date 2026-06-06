/**
 * Client-only mock store (pub/sub, no deps).
 * 절대 server fn에서 import 금지 (SSR 시 새 인스턴스).
 */
import { useSyncExternalStore } from "react";
import type {
  PromoAsset,
  PromoCampaign,
  PromoChannelId,
  PromoClick,
  PromoDispatch,
  PromoSettings,
  PromoVariant,
} from "../types";

interface State {
  campaigns: PromoCampaign[];
  dispatches: PromoDispatch[];
  clicks: PromoClick[];
  assets: PromoAsset[];
  settings: PromoSettings;
}

const SEED_CAMPAIGN: PromoCampaign = {
  id: "camp-seed",
  title: "PHONARA Launch Teaser",
  brief: "한국 P2E earn-flow 신규 유저 모집",
  targetUrl: "https://phonara.app",
  channels: ["telegram", "x", "slack"],
  variants: [
    {
      id: "v-tg",
      channel: "telegram",
      body: "PHONARA 정식 오픈! 가입 즉시 보너스.",
      hashtags: ["#phonara", "#p2e"],
      cta: "지금 가입",
      weight: 1,
    },
    {
      id: "v-x",
      channel: "x",
      body: "PHONARA launches. Earn-flow live now.",
      hashtags: ["#PHONARA", "#earnflow"],
      cta: "Try now",
      weight: 1,
    },
  ],
  scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
  status: "draft",
  riskScore: 12,
};

let state: State = {
  campaigns: [SEED_CAMPAIGN],
  dispatches: [],
  clicks: [
    { id: "c1", campaignId: "camp-seed", channel: "telegram", ts: new Date().toISOString() },
    { id: "c2", campaignId: "camp-seed", channel: "x", ts: new Date().toISOString() },
  ],
  assets: [],
  settings: {
    webhookUrl: "",
    hmacSecret: "",
    defaultUtmSource: "phonara-promo",
  },
};

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot(): State {
  return state;
}

export const promoMockStore = {
  subscribe,
  getSnapshot,
  upsertCampaign(c: PromoCampaign) {
    const i = state.campaigns.findIndex((x) => x.id === c.id);
    const next = [...state.campaigns];
    if (i >= 0) next[i] = c;
    else next.unshift(c);
    state = { ...state, campaigns: next };
    emit();
  },
  removeCampaign(id: string) {
    state = { ...state, campaigns: state.campaigns.filter((c) => c.id !== id) };
    emit();
  },
  scheduleCampaign(id: string, iso: string) {
    const next = state.campaigns.map((c) =>
      c.id === id ? { ...c, scheduledAt: iso, status: "scheduled" as const } : c,
    );
    state = { ...state, campaigns: next };
    emit();
  },
  addDispatch(d: PromoDispatch) {
    state = { ...state, dispatches: [d, ...state.dispatches] };
    emit();
  },
  addClick(c: PromoClick) {
    state = { ...state, clicks: [c, ...state.clicks] };
    emit();
  },
  addAsset(a: PromoAsset) {
    state = { ...state, assets: [a, ...state.assets] };
    emit();
  },
  updateSettings(s: Partial<PromoSettings>) {
    state = { ...state, settings: { ...state.settings, ...s } };
    emit();
  },
  appendVariant(campaignId: string, v: PromoVariant) {
    const next = state.campaigns.map((c) =>
      c.id === campaignId ? { ...c, variants: [...c.variants, v] } : c,
    );
    state = { ...state, campaigns: next };
    emit();
  },
  // test-only reset
  __reset(seed?: Partial<State>) {
    state = {
      campaigns: seed?.campaigns ?? [],
      dispatches: seed?.dispatches ?? [],
      clicks: seed?.clicks ?? [],
      assets: seed?.assets ?? [],
      settings:
        seed?.settings ?? { webhookUrl: "", hmacSecret: "", defaultUtmSource: "phonara-promo" },
    };
    emit();
  },
};

export function usePromoState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export type { PromoChannelId };

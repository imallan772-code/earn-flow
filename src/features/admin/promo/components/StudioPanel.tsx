import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { promoMockStore, usePromoState } from "../store/mockStore";
import { scanRiskLocal } from "@/lib/promo/risk";
import { ADMIN_KO, PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";
import { RiskBadge } from "./RiskBadge";
import { LivePreview } from "./LivePreview";
import { AbSplitBar } from "./AbSplitBar";
import type { PromoChannelId, PromoVariant } from "../types";

const CHANNELS: PromoChannelId[] = ["telegram", "x", "slack", "discord", "linkedin"];

export function StudioPanel() {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [targetUrl, setTargetUrl] = useState("https://phonara.app");
  const [generated, setGenerated] = useState<PromoVariant[]>([]);
  const campaigns = usePromoState((s) => s.campaigns);

  const risk = scanRiskLocal(`${title} ${brief}`);
  const ko = ADMIN_KO.promo.studio;

  const onGenerate = () => {
    if (!brief.trim()) return;
    const variants: PromoVariant[] = CHANNELS.map((ch, i) => ({
      id: `v-${Date.now()}-${i}`,
      channel: ch,
      body: `[${PROMO_CHANNEL_LABELS_KO[ch] ?? ch}] ${brief.slice(0, 80)}`,
      hashtags: ["#phonara", "#프로모"],
      cta: "지금 가입",
      weight: 1,
    }));
    setGenerated(variants);
  };

  const onSaveCampaign = () => {
    if (!title.trim() || generated.length === 0) return;
    promoMockStore.upsertCampaign({
      id: `camp-${Date.now()}`,
      title,
      brief,
      targetUrl,
      channels: CHANNELS,
      variants: generated,
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      status: "draft",
      riskScore: risk.score,
    });
    setTitle("");
    setBrief("");
    setGenerated([]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="glass-2 rounded-3xl p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <Wand2 size={16} /> {ko.composer}
          <span className="ml-auto text-[10px] font-normal text-(--color-muted)">{ko.composerHint}</span>
        </h2>
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={ko.titlePh}
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder={ko.briefPh}
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder={ko.urlPh}
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge score={risk.score} flags={risk.flags} />
            <button
              type="button"
              onClick={onGenerate}
              className="ml-auto flex items-center gap-1.5 rounded-2xl bg-holographic px-4 py-2 text-sm font-bold text-(--color-bg-0)"
            >
              <Sparkles size={14} /> {ko.generate}
            </button>
            <button
              type="button"
              onClick={onSaveCampaign}
              disabled={generated.length === 0}
              className="glass-1 rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {ko.save}
            </button>
          </div>
          {generated.length > 0 && <AbSplitBar variants={generated} />}
        </div>
        <p className="mt-3 text-[11px] text-(--color-muted)">{ko.campaignCount(campaigns.length)}</p>
      </section>

      <section className="glass-2 rounded-3xl p-5">
        <h2 className="mb-3 text-base font-bold">{ko.livePreview}</h2>
        <LivePreview variants={generated} targetUrl={targetUrl} />
      </section>
    </div>
  );
}

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { promoMockStore, usePromoState } from "../store/mockStore";
import { scanRiskLocal } from "@/lib/promo/risk";
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

  const onGenerate = () => {
    if (!brief.trim()) return;
    // Mock: 채널별 1개씩 변형 생성 (Z-1에서 실제 AI)
    const variants: PromoVariant[] = CHANNELS.map((ch, i) => ({
      id: `v-${Date.now()}-${i}`,
      channel: ch,
      body: `[${ch.toUpperCase()}] ${brief.slice(0, 80)}`,
      hashtags: ["#phonara", "#promo"],
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
          <Wand2 size={16} /> AI Composer
          <span className="ml-auto text-[10px] text-(--color-muted)">stub · Z-1 실연결</span>
        </h2>
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="캠페인 제목"
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder="홍보 brief — 무엇을, 누구에게, 어떤 톤으로"
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://target.url"
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <RiskBadge score={risk.score} flags={risk.flags} />
            <button
              type="button"
              onClick={onGenerate}
              className="ml-auto flex items-center gap-1.5 rounded-2xl bg-holographic px-4 py-2 text-sm font-bold text-(--color-bg-0)"
            >
              <Sparkles size={14} /> Generate
            </button>
            <button
              type="button"
              onClick={onSaveCampaign}
              disabled={generated.length === 0}
              className="glass-1 rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              저장
            </button>
          </div>
          {generated.length > 0 && <AbSplitBar variants={generated} />}
        </div>
        <p className="mt-3 text-[11px] text-(--color-muted)">
          총 {campaigns.length}개 캠페인 (mock store)
        </p>
      </section>

      <section className="glass-2 rounded-3xl p-5">
        <h2 className="mb-3 text-base font-bold">Live Preview</h2>
        <LivePreview variants={generated} targetUrl={targetUrl} />
      </section>
    </div>
  );
}

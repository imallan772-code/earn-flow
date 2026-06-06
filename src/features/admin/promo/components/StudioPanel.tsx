import { useEffect, useRef, useState } from "react";
import { Sparkles, Wand2, XCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { scanRiskLocal } from "@/lib/promo/risk";
import { composePromoVariants } from "@/lib/promo/promo.functions";
import { buildFallbackVariants } from "@/lib/promo/fallbackVariants";
import { ADMIN_KO } from "@/shared/admin/labels.ko";
import { RiskBadge } from "./RiskBadge";
import { LivePreview } from "./LivePreview";
import { AbSplitBar } from "./AbSplitBar";
import { VariantEditorCard } from "./VariantEditorCard";
import { usePromoAiStatus } from "../hooks/usePromoAiStatus";
import type { PromoChannelId, PromoVariant } from "../types";

const CHANNELS: PromoChannelId[] = ["telegram", "x", "slack", "discord", "linkedin"];

interface RiskState {
  localScore: number;
  aiScore?: number;
  mergedScore: number;
  flags: string[];
}

export function StudioPanel() {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [targetUrl, setTargetUrl] = useState("https://phonara.app");
  const [revealed, setRevealed] = useState<PromoVariant[]>([]);
  const pendingRef = useRef<PromoVariant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [aiRisk, setAiRisk] = useState<RiskState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { campaigns, upsertCampaign } = usePromoAdmin();
  const composeFn = useServerFn(composePromoVariants);
  const status = usePromoAiStatus();

  const localRisk = scanRiskLocal(`${title} ${brief}`);
  const ko = ADMIN_KO.promo.studio;
  const koAi = ADMIN_KO.promo.ai;
  const koErr = ADMIN_KO.promo.errors;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revealTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const stagger = (variants: PromoVariant[]) => {
    revealTimers.current.forEach((t) => clearTimeout(t));
    revealTimers.current = [];
    setRevealed([]);
    pendingRef.current = variants;
    variants.forEach((_, i) => {
      const t = setTimeout(() => {
        setRevealed((prev) => [...prev, pendingRef.current[i]]);
      }, 150 * i);
      revealTimers.current.push(t);
    });
  };

  const onGenerate = async () => {
    if (!brief.trim()) {
      toast.error(koErr.emptyBrief);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setGenerating(true);
    setAiRisk(null);

    try {
      const result = await composeFn({
        data: { brief, title, targetUrl, channels: CHANNELS },
        signal: ac.signal,
      });
      if (result.ok) {
        stagger(result.variants);
        setAiRisk({
          localScore: result.risk.localScore,
          aiScore: result.risk.aiScore,
          mergedScore: result.risk.mergedScore,
          flags: result.risk.flags,
        });
      } else {
        const fb = buildFallbackVariants(brief, CHANNELS);
        stagger(fb);
        toast.error(toastForCode(result.code));
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        const fb = buildFallbackVariants(brief, CHANNELS);
        stagger(fb);
        toast.error(koErr.generic);
      }
    } finally {
      setGenerating(false);
    }
  };

  const onCancel = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  const onVariantChange = (next: PromoVariant) => {
    setRevealed((prev) => prev.map((v) => (v.id === next.id ? next : v)));
    pendingRef.current = pendingRef.current.map((v) => (v.id === next.id ? next : v));
  };

  const onSaveCampaign = () => {
    if (!title.trim() || revealed.length === 0) return;
    upsertCampaign({
      id: `camp-${Date.now()}`,
      title,
      brief,
      targetUrl,
      channels: CHANNELS,
      variants: revealed,
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      status: "draft",
      riskScore: aiRisk?.mergedScore ?? localRisk.score,
    });
    setTitle("");
    setBrief("");
    setRevealed([]);
    setAiRisk(null);
    pendingRef.current = [];
  };

  function toastForCode(code: string): string {
    switch (code) {
      case "AI_NOT_CONFIGURED":
        return koErr.notConfigured;
      case "AI_RATE_LIMITED":
        return koErr.rateLimited;
      case "AI_TIMEOUT":
        return koErr.timeout;
      case "AI_PARSE_ERROR":
        return koErr.parseError;
      case "AI_ERROR":
      default:
        return koErr.gatewayError;
    }
  }

  const hint = status.loading
    ? ko.composerHint
    : status.configured
      ? ko.composerHintConfigured
      : ko.composerHintFallback;

  const providerBadge = status.loading
    ? null
    : status.configured
      ? (status.provider === "gemini-direct" ? koAi.providerGemini : koAi.providerGateway)
      : koAi.notConfigured;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="glass-2 rounded-3xl p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <Wand2 size={16} /> {ko.composer}
          {providerBadge && (
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                status.configured
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/10 text-(--color-muted)"
              }`}
            >
              {providerBadge}
            </span>
          )}
        </h2>
        <p className="mb-3 text-[11px] text-(--color-muted)">{hint}</p>
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
            <RiskBadge
              score={aiRisk?.mergedScore ?? localRisk.score}
              flags={aiRisk?.flags ?? localRisk.flags}
              localScore={aiRisk?.localScore ?? localRisk.score}
              aiScore={aiRisk?.aiScore}
            />
            {generating ? (
              <button
                type="button"
                onClick={onCancel}
                className="ml-auto flex items-center gap-1.5 rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-(--color-foreground)"
              >
                <XCircle size={14} /> {ko.cancel}
              </button>
            ) : (
              <button
                type="button"
                onClick={onGenerate}
                disabled={generating}
                className="ml-auto flex items-center gap-1.5 rounded-2xl bg-holographic px-4 py-2 text-sm font-bold text-(--color-bg-0) disabled:opacity-50"
              >
                <Sparkles size={14} /> {generating ? ko.generating : ko.generate}
              </button>
            )}
            <button
              type="button"
              onClick={onSaveCampaign}
              disabled={revealed.length === 0 || !title.trim()}
              className="glass-1 rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {ko.save}
            </button>
          </div>
          {revealed.length > 0 && <AbSplitBar variants={revealed} />}
          {generating && revealed.length === 0 && (
            <div className="flex flex-col gap-2">
              {CHANNELS.map((_, i) => (
                <div
                  key={i}
                  className="glass-1 h-20 animate-pulse rounded-2xl"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {revealed.map((v) => (
              <VariantEditorCard key={v.id} variant={v} onChange={onVariantChange} />
            ))}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-(--color-muted)">{ko.campaignCount(campaigns.length)}</p>
      </section>

      <section className="glass-2 rounded-3xl p-5">
        <h2 className="mb-3 text-base font-bold">{ko.livePreview}</h2>
        <LivePreview variants={revealed} targetUrl={targetUrl} />
      </section>
    </div>
  );
}

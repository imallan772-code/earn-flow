import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PROMO_CHANNEL_LABELS_KO, ADMIN_KO } from "@/shared/admin/labels.ko";
import { getAdminAuthHeaders } from "@/lib/admin/session";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import type { PromoVariant } from "../types";

interface Props {
  variant: PromoVariant;
  onChange: (next: PromoVariant) => void;
}

interface SseDone {
  ok: true;
  mimeType: string;
  base64: string;
  imageUrl?: string;
  assetId?: string;
}

interface SseErr {
  ok: false;
  code: string;
}

function parseSseEvents(buffer: string): { events: Array<{ name: string; data: string }>; rest: string } {
  const out: Array<{ name: string; data: string }> = [];
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() ?? "";
  for (const chunk of chunks) {
    let name = "message";
    let data = "";
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) name = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (data) out.push({ name, data });
  }
  return { events: out, rest };
}

export function VariantEditorCard({ variant, onChange }: Props) {
  const ko = ADMIN_KO.promo.studio.variantCard;
  const koImg = ADMIN_KO.promo.image;
  const { addAsset } = usePromoAdmin();
  const [genState, setGenState] = useState<"idle" | "loading">("idle");
  const abortRef = useRef<AbortController | null>(null);

  async function onGenerateImage() {
    const prompt = variant.imagePrompt?.trim();
    if (!prompt) {
      toast.error(koImg.promptEmpty);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setGenState("loading");
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/promo/image-stream", {
        method: "POST",
        signal: ac.signal,
        headers,
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok || !res.body) {
        toast.error(koImg.error);
        setGenState("idle");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseEvents(buf);
        buf = rest;
        for (const e of events) {
          if (e.name === "done") {
            const payload = JSON.parse(e.data) as SseDone;
            const dataUrl = `data:${payload.mimeType};base64,${payload.base64}`;
            const imageUrl = payload.imageUrl ?? dataUrl;
            onChange({ ...variant, imageUrl });
            addAsset({
              id: payload.assetId ?? `img-${variant.id}-${Date.now()}`,
              kind: "image",
              url: imageUrl,
              alt: prompt.slice(0, 80),
              createdAt: new Date().toISOString(),
            });
            toast.success(koImg.done);
          } else if (e.name === "error") {
            const err = JSON.parse(e.data) as SseErr;
            toast.error(err.code === "IMAGE_NOT_CONFIGURED" ? koImg.notConfigured : koImg.error);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(koImg.error);
    } finally {
      setGenState("idle");
    }
  }

  function onCancelImage() {
    abortRef.current?.abort();
    setGenState("idle");
  }

  return (
    <article className="glass-1 flex flex-col gap-2 rounded-2xl p-3">
      <header className="flex items-center justify-between">
        <div className="text-[11px] font-bold tracking-wider text-(--color-muted)">
          {PROMO_CHANNEL_LABELS_KO[variant.channel] ?? variant.channel}
        </div>
        <label className="flex items-center gap-1 text-[10px] text-(--color-muted)">
          {ko.weight}
          <input
            type="range"
            min={0}
            max={5}
            step={1}
            value={variant.weight}
            onChange={(e) => onChange({ ...variant, weight: Number(e.target.value) })}
            className="accent-(--color-accent)"
          />
          <span className="w-3 text-right font-numeric">{variant.weight}</span>
        </label>
      </header>
      <textarea
        value={variant.body}
        rows={3}
        onChange={(e) => onChange({ ...variant, body: e.target.value })}
        placeholder={ko.bodyPh}
        className="glass-1 rounded-lg px-2 py-1.5 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={variant.hashtags.join(" ")}
          onChange={(e) =>
            onChange({
              ...variant,
              hashtags: e.target.value.split(/\s+/).filter((t) => t.length > 0),
            })
          }
          placeholder={ko.hashtagsPh}
          className="glass-1 rounded-lg px-2 py-1.5 text-xs"
        />
        <input
          value={variant.cta ?? ""}
          onChange={(e) => onChange({ ...variant, cta: e.target.value })}
          placeholder={ko.ctaPh}
          className="glass-1 rounded-lg px-2 py-1.5 text-xs"
        />
      </div>
      <input
        value={variant.imagePrompt ?? ""}
        onChange={(e) => onChange({ ...variant, imagePrompt: e.target.value || undefined })}
        placeholder={ko.imagePromptPh}
        className="glass-1 rounded-lg px-2 py-1.5 text-[11px] text-(--color-muted)"
      />
      <div className="flex items-center gap-2">
        {genState === "loading" ? (
          <button
            type="button"
            onClick={onCancelImage}
            className="glass-1 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px]"
          >
            <XCircle size={11} /> {koImg.cancel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onGenerateImage}
            className="glass-1 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px]"
          >
            <ImageIcon size={11} /> {koImg.generate}
          </button>
        )}
        {genState === "loading" && (
          <span className="flex items-center gap-1 text-[11px] text-(--color-muted)">
            <Loader2 size={11} className="animate-spin" /> {koImg.generating}
          </span>
        )}
        {variant.imageUrl && (
          <span className="ml-auto text-[10px] text-(--color-muted)">{koImg.done}</span>
        )}
      </div>
      {variant.imageUrl && (
        <img
          src={variant.imageUrl}
          alt={variant.imagePrompt ?? ""}
          className="mt-1 max-h-48 w-full rounded-lg object-cover"
        />
      )}
    </article>
  );
}

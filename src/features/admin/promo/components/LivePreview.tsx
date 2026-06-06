import { buildUtmUrl } from "@/lib/promo/utm";
import { ADMIN_KO, PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";
import type { PromoVariant } from "../types";

const TYPES = ["telegram", "x", "slack", "discord", "linkedin"] as const;

const FRAME_STYLE: Record<(typeof TYPES)[number], string> = {
  telegram: "border-l-2 border-sky-400/60",
  x: "border-l-2 border-white/40",
  slack: "border-l-2 border-fuchsia-400/60",
  discord: "border-l-2 border-indigo-400/60",
  linkedin: "border-l-2 border-blue-400/60",
};

export function LivePreview({
  variants,
  targetUrl,
}: {
  variants: PromoVariant[];
  targetUrl: string;
}) {
  if (variants.length === 0) {
    return <p className="text-xs text-(--color-muted)">{ADMIN_KO.promo.studio.previewEmpty}</p>;
  }
  const totalWeight = variants.reduce((acc, v) => acc + Math.max(0, v.weight), 0) || 1;
  return (
    <div className="flex flex-col gap-3">
      {TYPES.map((t) => {
        const v = variants.find((x) => x.channel === t);
        if (!v) return null;
        let url = targetUrl;
        try {
          url = buildUtmUrl(targetUrl, {
            source: "phonara",
            medium: t,
            campaign: "preview",
          });
        } catch {
          /* invalid url */
        }
        const ratio = Math.round((Math.max(0, v.weight) / totalWeight) * 100);
        return (
          <article key={t} className={`glass-1 rounded-2xl p-3 pl-4 ${FRAME_STYLE[t]}`}>
            <header className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-(--color-muted)">
              <span>{PROMO_CHANNEL_LABELS_KO[t] ?? t}</span>
              <span className="font-numeric opacity-70">w {v.weight} · {ratio}%</span>
            </header>
            {v.imageUrl && (
              <img
                src={v.imageUrl}
                alt=""
                className="mb-2 max-h-40 w-full rounded-lg object-cover"
              />
            )}
            <p className="text-sm whitespace-pre-wrap">{v.body}</p>
            <p className="mt-1 text-[11px] text-(--color-muted)">
              {v.hashtags.join(" ")}
              {v.cta ? ` · ${v.cta}` : ""}
            </p>
            <p className="font-numeric mt-1 truncate text-[10px] text-(--color-muted)">{url}</p>
          </article>
        );
      })}
    </div>
  );
}

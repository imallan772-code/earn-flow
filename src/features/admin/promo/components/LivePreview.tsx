import { buildUtmUrl } from "@/lib/promo/utm";
import type { PromoVariant } from "../types";

const TYPES = ["telegram", "x", "slack", "discord", "linkedin"] as const;

export function LivePreview({
  variants,
  targetUrl,
}: {
  variants: PromoVariant[];
  targetUrl: string;
}) {
  if (variants.length === 0) {
    return (
      <p className="text-xs text-(--color-muted)">
        Generate를 누르면 채널별 미리보기 5종이 여기에 표시됩니다.
      </p>
    );
  }
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
        return (
          <article key={t} className="glass-1 rounded-2xl p-3">
            <header className="mb-1 text-[10px] font-bold tracking-wider text-(--color-muted)">
              {t.toUpperCase()}
            </header>
            <p className="text-sm">{v.body}</p>
            <p className="mt-1 text-[11px] text-(--color-muted)">
              {v.hashtags.join(" ")} · {v.cta}
            </p>
            <p className="font-numeric mt-1 truncate text-[10px] text-(--color-muted)">{url}</p>
          </article>
        );
      })}
    </div>
  );
}

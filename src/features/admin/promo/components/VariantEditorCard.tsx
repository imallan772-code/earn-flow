import { PROMO_CHANNEL_LABELS_KO, ADMIN_KO } from "@/shared/admin/labels.ko";
import type { PromoVariant } from "../types";

interface Props {
  variant: PromoVariant;
  onChange: (next: PromoVariant) => void;
}

export function VariantEditorCard({ variant, onChange }: Props) {
  const ko = ADMIN_KO.promo.studio.variantCard;
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
    </article>
  );
}

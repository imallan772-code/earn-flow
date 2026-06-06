import { splitVariants } from "@/lib/promo/abSplit";
import type { PromoVariant } from "../types";

export function AbSplitBar({ variants }: { variants: PromoVariant[] }) {
  const split = splitVariants(
    variants.map((v) => ({ id: v.id, weight: v.weight, payload: v.channel })),
  );
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
      {split.map((s, i) => (
        <div
          key={s.variantId}
          style={{ width: `${s.ratio * 100}%` }}
          className={i % 2 === 0 ? "bg-holographic" : "bg-(--color-accent)"}
          title={`${s.payload} · ${(s.ratio * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  );
}

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { ADMIN_KO } from "@/shared/admin/labels.ko";

export function RiskBadge({ score, flags }: { score: number; flags: string[] }) {
  const level = score >= 60 ? "high" : score >= 25 ? "medium" : "low";
  const color =
    level === "high"
      ? "bg-(--color-rose)/20 text-(--color-rose)"
      : level === "medium"
        ? "bg-yellow-500/20 text-yellow-300"
        : "bg-emerald-500/20 text-emerald-300";
  const Icon = level === "low" ? ShieldCheck : ShieldAlert;
  return (
    <span
      title={flags.join(", ") || ADMIN_KO.promo.risk.noFlags}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}
    >
      <Icon size={11} />
      {ADMIN_KO.promo.risk.label(score)}
    </span>
  );
}

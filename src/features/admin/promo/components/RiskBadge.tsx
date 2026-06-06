import { ShieldAlert, ShieldCheck } from "lucide-react";
import { ADMIN_KO } from "@/shared/admin/labels.ko";
import { levelFromScore } from "@/lib/promo/risk";

interface Props {
  /** 항상 표시되는 merged 점수 (없으면 localScore와 동일) */
  score: number;
  flags: string[];
  /** Z-1: AI 병합 점수 분리 표시 (tooltip) */
  localScore?: number;
  aiScore?: number;
}

export function RiskBadge({ score, flags, localScore, aiScore }: Props) {
  const level = levelFromScore(score);
  const color =
    level === "high"
      ? "bg-(--color-rose)/20 text-(--color-rose)"
      : level === "medium"
        ? "bg-yellow-500/20 text-yellow-300"
        : "bg-emerald-500/20 text-emerald-300";
  const Icon = level === "low" ? ShieldCheck : ShieldAlert;

  const ko = ADMIN_KO.promo.risk;
  const tooltipParts: string[] = [];
  if (typeof localScore === "number") tooltipParts.push(`${ko.localLabel} ${localScore}`);
  if (typeof aiScore === "number") tooltipParts.push(`${ko.aiLabel} ${aiScore}`);
  if (flags.length > 0) tooltipParts.push(flags.join(", "));
  const title = tooltipParts.length > 0 ? tooltipParts.join(" · ") : ko.noFlags;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}
    >
      <Icon size={11} />
      {ko.label(score)}
      {typeof aiScore === "number" && (
        <span className="ml-1 opacity-70">({ko.mergedHint})</span>
      )}
    </span>
  );
}

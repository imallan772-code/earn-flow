import { Trash2 } from "lucide-react";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { ADMIN_KO, promoStatusLabel } from "@/shared/admin/labels.ko";
import { RiskBadge } from "./RiskBadge";

export function CampaignTable() {
  const { campaigns, removeCampaign, loading } = usePromoAdmin();
  const ko = ADMIN_KO.promo.campaigns;
  return (
    <section className="glass-2 rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">{ko.title}</h2>
      {loading ? (
        <p className="text-xs text-(--color-muted)">{ko.loading}</p>
      ) : campaigns.length === 0 ? (
        <p className="text-xs text-(--color-muted)">{ko.empty}</p>
      ) : (
        <div className="grid gap-2">
          {campaigns.map((c) => (
            <div key={c.id} className="glass-1 flex items-center gap-3 rounded-2xl p-3">
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold">
                {promoStatusLabel(c.status)}
              </span>
              <span className="flex-1 truncate text-sm font-semibold">{c.title}</span>
              <RiskBadge score={c.riskScore} flags={[]} />
              <span className="font-numeric text-[11px] text-(--color-muted)">
                {c.scheduledAt.slice(0, 16).replace("T", " ")}
              </span>
              <button
                onClick={() => removeCampaign(c.id)}
                className="rounded-lg p-1.5 text-(--color-rose) hover:bg-white/8"
                aria-label={ko.delete}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

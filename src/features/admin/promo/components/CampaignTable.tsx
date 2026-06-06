import { Trash2 } from "lucide-react";
import { promoMockStore, usePromoState } from "../store/mockStore";
import { RiskBadge } from "./RiskBadge";

export function CampaignTable() {
  const campaigns = usePromoState((s) => s.campaigns);
  return (
    <section className="glass-2 rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">Campaigns</h2>
      {campaigns.length === 0 ? (
        <p className="text-xs text-(--color-muted)">
          캠페인이 아직 없습니다. Studio에서 생성하세요.
        </p>
      ) : (
        <div className="grid gap-2">
          {campaigns.map((c) => (
            <div key={c.id} className="glass-1 flex items-center gap-3 rounded-2xl p-3">
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase">
                {c.status}
              </span>
              <span className="flex-1 truncate text-sm font-semibold">{c.title}</span>
              <RiskBadge score={c.riskScore} flags={[]} />
              <span className="font-numeric text-[11px] text-(--color-muted)">
                {c.scheduledAt.slice(0, 16).replace("T", " ")}
              </span>
              <button
                onClick={() => promoMockStore.removeCampaign(c.id)}
                className="rounded-lg p-1.5 text-(--color-rose) hover:bg-white/8"
                aria-label="delete"
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

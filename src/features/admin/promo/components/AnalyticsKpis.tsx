import { usePromoState } from "../store/mockStore";
import { ADMIN_KO } from "@/shared/admin/labels.ko";

export function AnalyticsKpis() {
  const clicks = usePromoState((s) => s.clicks);
  const dispatches = usePromoState((s) => s.dispatches);
  const impressions = dispatches.length * 100;
  const ctr = impressions > 0 ? (clicks.length / impressions) * 100 : 0;
  const ko = ADMIN_KO.promo.analytics;

  const cards = [
    { label: ko.impressions, value: impressions.toLocaleString("ko-KR") },
    { label: ko.clicks, value: clicks.length.toLocaleString("ko-KR") },
    { label: ko.ctr, value: `${ctr.toFixed(2)}%` },
    { label: ko.dispatches, value: dispatches.length.toLocaleString("ko-KR") },
  ];
  return (
    <section className="glass-2 rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">{ko.title}</h2>
      <p className="mb-4 text-[11px] text-(--color-muted)">{ko.hint}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-1 rounded-2xl p-4">
            <div className="text-[10px] tracking-wide text-(--color-muted)">{c.label}</div>
            <div className="font-numeric mt-1 text-2xl font-extrabold">{c.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

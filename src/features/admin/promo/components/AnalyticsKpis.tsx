import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { ADMIN_KO } from "@/shared/admin/labels.ko";

export function AnalyticsKpis() {
  const { analytics, configured, loading } = usePromoAdmin();
  const ctr =
    analytics.impressions > 0 ? (analytics.clicks / analytics.impressions) * 100 : 0;
  const ko = ADMIN_KO.promo.analytics;
  const hint = configured ? ko.hintConfigured : ko.hint;

  const cards = [
    { label: ko.impressions, value: analytics.impressions.toLocaleString("ko-KR") },
    { label: ko.clicks, value: analytics.clicks.toLocaleString("ko-KR") },
    { label: ko.ctr, value: `${ctr.toFixed(2)}%` },
    { label: ko.dispatches, value: analytics.dispatches.toLocaleString("ko-KR") },
  ];
  return (
    <section className="glass-2 rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">{ko.title}</h2>
      <p className="mb-4 text-[11px] text-(--color-muted)">{loading ? ko.loading : hint}</p>
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

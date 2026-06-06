import { usePromoState } from "../store/mockStore";

export function AnalyticsKpis() {
  const clicks = usePromoState((s) => s.clicks);
  const dispatches = usePromoState((s) => s.dispatches);
  const impressions = dispatches.length * 100; // mock
  const ctr = impressions > 0 ? (clicks.length / impressions) * 100 : 0;

  const cards = [
    { label: "Impressions", value: impressions.toLocaleString() },
    { label: "Clicks", value: clicks.length.toLocaleString() },
    { label: "CTR", value: `${ctr.toFixed(2)}%` },
    { label: "Dispatches", value: dispatches.length.toLocaleString() },
  ];
  return (
    <section className="glass-2 rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">Analytics</h2>
      <p className="mb-4 text-[11px] text-(--color-muted)">
        Mock 집계 · Z-DB 머지 후 promo_clicks 실데이터 연결.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-1 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-(--color-muted)">
              {c.label}
            </div>
            <div className="font-numeric mt-1 text-2xl font-extrabold">{c.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

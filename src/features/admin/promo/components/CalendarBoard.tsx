import { promoMockStore, usePromoState } from "../store/mockStore";

export function CalendarBoard() {
  const campaigns = usePromoState((s) => s.campaigns);
  return (
    <section className="glass-2 rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">Calendar</h2>
      <p className="mb-3 text-[11px] text-(--color-muted)">
        예약 시각을 변경하면 mockStore에 즉시 반영됩니다 (Z-DB 머지 후 supabase로 교체).
      </p>
      <div className="grid gap-2">
        {campaigns.map((c) => (
          <div key={c.id} className="glass-1 flex items-center gap-3 rounded-2xl p-3">
            <span className="flex-1 truncate text-sm font-semibold">{c.title}</span>
            <input
              type="datetime-local"
              value={c.scheduledAt.slice(0, 16)}
              onChange={(e) =>
                promoMockStore.scheduleCampaign(c.id, new Date(e.target.value).toISOString())
              }
              className="glass-1 rounded-lg px-2 py-1 text-xs"
            />
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="text-xs text-(--color-muted)">캠페인이 없습니다.</p>
        )}
      </div>
    </section>
  );
}

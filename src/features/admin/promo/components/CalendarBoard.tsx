import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { ADMIN_KO } from "@/shared/admin/labels.ko";

export function CalendarBoard() {
  const { campaigns, scheduleCampaign, configured, loading } = usePromoAdmin();
  const ko = ADMIN_KO.promo.calendar;
  const hint = configured ? ko.hintConfigured : ko.hint;
  return (
    <section className="glass-2 rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">{ko.title}</h2>
      <p className="mb-3 text-[11px] text-(--color-muted)">{hint}</p>
      {loading ? (
        <p className="text-xs text-(--color-muted)">{ko.loading}</p>
      ) : (
        <div className="grid gap-2">
          {campaigns.map((c) => (
            <div key={c.id} className="glass-1 flex items-center gap-3 rounded-2xl p-3">
              <span className="flex-1 truncate text-sm font-semibold">{c.title}</span>
              <input
                type="datetime-local"
                value={c.scheduledAt.slice(0, 16)}
                onChange={(e) =>
                  scheduleCampaign(c.id, new Date(e.target.value).toISOString())
                }
                className="glass-1 rounded-lg px-2 py-1 text-xs"
              />
            </div>
          ))}
          {campaigns.length === 0 && <p className="text-xs text-(--color-muted)">{ko.empty}</p>}
        </div>
      )}
    </section>
  );
}

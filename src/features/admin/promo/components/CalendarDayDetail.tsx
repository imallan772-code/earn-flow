import { ADMIN_KO, promoStatusLabel } from "@/shared/admin/labels.ko";
import { RiskBadge } from "./RiskBadge";
import type { PromoCampaign } from "../types";

interface Props {
  ymd: string;
  campaigns: PromoCampaign[];
  onSchedule: (id: string, iso: string) => void;
}

export function CalendarDayDetail({ ymd, campaigns, onSchedule }: Props) {
  const ko = ADMIN_KO.promo.calendar;
  return (
    <aside className="glass-1 flex flex-col gap-2 rounded-2xl p-3">
      <div className="text-[11px] font-semibold text-(--color-muted)">{ko.dayDetail(ymd)}</div>
      {campaigns.length === 0 ? (
        <p className="text-xs text-(--color-muted)">{ko.dayEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id} className="glass-2 flex flex-col gap-1.5 rounded-xl p-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1 truncate text-sm font-semibold">{c.title}</span>
                <span className="text-[10px] text-(--color-muted)">
                  {promoStatusLabel(c.status)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-(--color-muted)">
                <RiskBadge score={c.riskScore} flags={[]} />
                <span>채널 {c.channels.length}</span>
              </div>
              <input
                type="datetime-local"
                value={c.scheduledAt.slice(0, 16)}
                onChange={(e) => onSchedule(c.id, new Date(e.target.value).toISOString())}
                className="glass-1 rounded-lg px-2 py-1 text-xs"
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

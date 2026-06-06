import { ADMIN_KO, promoStatusLabel } from "@/shared/admin/labels.ko";
import type { DayCell } from "@/lib/promo/calendarGrid";
import type { PromoCampaign, PromoStatus } from "../types";

const STATUS_DOT: Record<PromoStatus, string> = {
  draft: "bg-(--color-muted)",
  scheduled: "bg-(--color-accent)",
  publishing: "bg-(--color-accent)",
  done: "bg-(--color-emerald)",
  failed: "bg-(--color-rose)",
};

const STATUS_BORDER: Record<PromoStatus, string> = {
  draft: "border-l-(--color-muted)",
  scheduled: "border-l-(--color-accent)",
  publishing: "border-l-(--color-accent)",
  done: "border-l-(--color-emerald)",
  failed: "border-l-(--color-rose)",
};

interface Props {
  grid: DayCell[][];
  selectedYmd: string;
  onSelect: (ymd: string) => void;
}

export function CalendarMonthGrid({ grid, selectedYmd, onSelect }: Props) {
  const ko = ADMIN_KO.promo.calendar;
  const todayYmd = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[26rem]">
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-(--color-muted)">
          {ko.weekdays.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.flat().map((cell) => {
            const isSelected = cell.ymd === selectedYmd;
            const isToday = cell.ymd === todayYmd;
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => onSelect(cell.ymd)}
                className={[
                  "glass-1 flex h-20 flex-col gap-1 rounded-xl p-1.5 text-left transition",
                  cell.inMonth ? "" : "opacity-40",
                  isSelected ? "ring-2 ring-(--color-accent)" : "hover:bg-white/5",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] ${isToday ? "font-bold text-(--color-accent)" : "text-(--color-muted)"}`}
                  >
                    {cell.date.getDate()}
                  </span>
                  {cell.campaigns.length > 1 && (
                    <span className="font-numeric text-[9px] text-(--color-muted)">
                      {cell.campaigns.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {cell.campaigns.slice(0, 2).map((c) => (
                    <Pill key={c.id} c={c} />
                  ))}
                  {cell.campaigns.length > 2 && (
                    <span className="text-[9px] text-(--color-muted)">
                      +{cell.campaigns.length - 2}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Pill({ c }: { c: PromoCampaign }) {
  const ko = ADMIN_KO.promo.calendar;
  const dot = STATUS_DOT[c.status];
  const border = STATUS_BORDER[c.status];
  const tooltip = ko.pillTooltip(
    c.title,
    promoStatusLabel(c.status),
    new Date(c.scheduledAt).toLocaleString("ko-KR"),
  );
  return (
    <span
      title={tooltip}
      className={`flex items-center gap-1 truncate rounded border-l-2 ${border} bg-white/5 px-1 py-0.5 text-[10px]`}
    >
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{c.title}</span>
    </span>
  );
}

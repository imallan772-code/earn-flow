import { useMemo, useState } from "react";
import { m } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ADMIN_KO, promoStatusLabel } from "@/shared/admin/labels.ko";
import { Skeleton } from "@/components/ui/skeleton";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { buildMonthGrid, shiftMonth, ymdKey } from "@/lib/promo/calendarGrid";
import type { PromoCampaign, PromoStatus } from "../types";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarDayDetail } from "./CalendarDayDetail";

type ViewMode = "grid" | "list";

const LEGEND: Array<{ status: PromoStatus; cls: string }> = [
  { status: "draft", cls: "bg-(--color-muted)" },
  { status: "scheduled", cls: "bg-(--color-accent)" },
  { status: "publishing", cls: "bg-(--color-accent)" },
  { status: "done", cls: "bg-(--color-emerald)" },
  { status: "failed", cls: "bg-(--color-rose)" },
];

export function CalendarBoard() {
  const { campaigns, scheduleCampaign, persisting, loading } = usePromoAdmin();
  const ko = ADMIN_KO.promo.calendar;
  const hint = persisting ? ko.hintConfigured : ko.hint;

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedYmd, setSelectedYmd] = useState<string>(ymdKey(now));

  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, campaigns),
    [cursor.year, cursor.month, campaigns],
  );

  const dayCampaigns = useMemo(() => {
    return grid.flat().find((c) => c.ymd === selectedYmd)?.campaigns ?? [];
  }, [grid, selectedYmd]);

  if (persisting && loading) {
    return (
      <section className="glass-2 rounded-3xl p-5">
        <Skeleton className="mb-3 h-5 w-32" />
        <Skeleton className="mb-4 h-3 w-64" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 42 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  const go = (delta: number) => setCursor((c) => shiftMonth(c.year, c.month, delta));
  const goToday = () => {
    const n = new Date();
    setCursor({ year: n.getFullYear(), month: n.getMonth() });
    setSelectedYmd(ymdKey(n));
  };

  return (
    <section className="glass-2 rounded-3xl p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{ko.title}</h2>
          <p className="mt-1 text-[11px] text-(--color-muted)">{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={ko.prevMonth}
            onClick={() => go(-1)}
            className="glass-1 inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/5"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="font-numeric min-w-[6.5rem] text-center text-sm font-semibold">
            {ko.monthLabel(cursor.year, cursor.month)}
          </div>
          <button
            type="button"
            aria-label={ko.nextMonth}
            onClick={() => go(1)}
            className="glass-1 inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/5"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="glass-1 ml-1 rounded-xl px-3 py-1.5 text-xs hover:bg-white/5"
          >
            {ko.today}
          </button>
          <div className="glass-1 ml-2 flex rounded-xl p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`rounded-lg px-2 py-1 ${view === "grid" ? "bg-white/10 font-semibold" : "text-(--color-muted)"}`}
            >
              {ko.gridView}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-lg px-2 py-1 ${view === "list" ? "bg-white/10 font-semibold" : "text-(--color-muted)"}`}
            >
              {ko.listView}
            </button>
          </div>
        </div>
      </header>

      <m.div
        key={`${cursor.year}-${cursor.month}-${view}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {view === "grid" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <CalendarMonthGrid grid={grid} selectedYmd={selectedYmd} onSelect={setSelectedYmd} />
            <CalendarDayDetail
              ymd={selectedYmd}
              campaigns={dayCampaigns}
              onSchedule={scheduleCampaign}
            />
          </div>
        ) : (
          <ListView campaigns={campaigns} onSchedule={scheduleCampaign} />
        )}
      </m.div>

      <footer className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-(--color-muted)">
        <span>{ko.statusLegend}:</span>
        {LEGEND.map((l) => (
          <span key={l.status} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${l.cls}`} />
            {promoStatusLabel(l.status)}
          </span>
        ))}
      </footer>
    </section>
  );
}

function ListView({
  campaigns,
  onSchedule,
}: {
  campaigns: PromoCampaign[];
  onSchedule: (id: string, iso: string) => void;
}) {
  const ko = ADMIN_KO.promo.calendar;
  if (campaigns.length === 0) return <p className="text-xs text-(--color-muted)">{ko.empty}</p>;
  return (
    <div className="grid gap-2">
      {campaigns.map((c) => (
        <div key={c.id} className="glass-1 flex items-center gap-3 rounded-2xl p-3">
          <span className="flex-1 truncate text-sm font-semibold">{c.title}</span>
          <span className="text-[10px] text-(--color-muted)">{promoStatusLabel(c.status)}</span>
          <input
            type="datetime-local"
            value={c.scheduledAt.slice(0, 16)}
            onChange={(e) => onSchedule(c.id, new Date(e.target.value).toISOString())}
            className="glass-1 rounded-lg px-2 py-1 text-xs"
          />
        </div>
      ))}
    </div>
  );
}

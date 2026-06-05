import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Users, Clock } from "lucide-react";
import type { AppEventView } from "@/lib/api/events";
import type { EventStatus } from "@/lib/events/schemas";
import { countdownTo, countdownTargetForEvent } from "@/lib/events/countdown";
import { useEvents } from "@/shared/events/useEvents";
import { cn } from "@/lib/utils";

const TABS: EventStatus[] = ["진행중", "예정", "종료"];

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return countdownTo(target, now);
}

export function EventScreen() {
  const [tab, setTab] = useState<EventStatus>("진행중");
  const { events } = useEvents();
  const list = useMemo(() => events.filter((e) => e.status === tab), [events, tab]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">이벤트</h1>
        <p className="text-sm text-(--color-muted)">놓치면 후회하는 한정 보상</p>
      </header>

      <div className="glass-2 flex gap-1 rounded-2xl p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-xl py-2 text-xs font-semibold transition",
              tab === t ? "bg-holographic text-(--color-bg-0)" : "text-(--color-muted)",
            )}
          >
            {t}
            <span className="ml-1.5 text-[10px] opacity-70">
              {events.filter((e) => e.status === t).length}
            </span>
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-3">
        {list.map((e) => (
          <EventCard key={e.id} e={e} />
        ))}
        {list.length === 0 && (
          <li className="glass-1 rounded-2xl p-8 text-center text-sm text-(--color-muted)">
            해당 상태의 이벤트가 없습니다.
          </li>
        )}
      </ul>
    </div>
  );
}

export function EventCard({ e }: { e: AppEventView }) {
  const cd = useCountdown(countdownTargetForEvent(e.status, e.startsAt, e.endsAt));
  const pct = Math.round(e.progress * 100);

  return (
    <Link
      to="/event/$id"
      params={{ id: e.id }}
      className="group relative overflow-hidden rounded-3xl p-5 shadow-depth-2 transition active:scale-[0.99]"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${e.bgFrom} 35%, var(--color-bg-1)) 0%, color-mix(in oklab, ${e.bgTo} 35%, var(--color-bg-1)) 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        style={{ background: "radial-gradient(ellipse at top right, white, transparent 60%)" }}
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
            {e.status}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
            {e.tagline}
          </span>
        </div>
        <h3 className="text-lg font-extrabold leading-snug">{e.title}</h3>
        <div className="flex items-center gap-1 text-xs font-semibold">
          <Trophy size={12} className="text-gold" />
          {e.rewardPreview}
        </div>

        {e.status !== "종료" && (
          <div className="glass-2 flex items-center justify-between rounded-2xl px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] text-(--color-muted)">
              <Clock size={11} />
              {e.status === "예정" ? "오픈까지" : "남은 시간"}
            </div>
            <div className="font-numeric text-sm font-bold tabular-nums">
              {cd.d > 0 && `${cd.d}일 `}
              {String(cd.h).padStart(2, "0")}:{String(cd.m).padStart(2, "0")}:
              {String(cd.s).padStart(2, "0")}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-(--color-muted)">
              <Users size={11} />
              <span className="font-numeric">{e.participants.toLocaleString()}</span>명 참여
            </span>
            <span className="font-numeric font-bold">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-holographic transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

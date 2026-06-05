import { Link } from "@tanstack/react-router";
import { ArrowLeft, Trophy, Users, Clock, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { countdownTo, countdownTargetForEvent } from "@/lib/events/countdown";
import { useEventDetail, useJoinEvent } from "@/shared/events/useEvents";
import { appToast } from "@/shared/ui/toast";

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return countdownTo(target, now);
}

export function EventDetail({ id }: { id: string }) {
  const { event: e, leaderboard } = useEventDetail(id);
  const join = useJoinEvent();
  const cd = useCountdown(
    e ? countdownTargetForEvent(e.status, e.startsAt, e.endsAt) : new Date().toISOString(),
  );

  if (!e) {
    return (
      <div className="glass-2 rounded-2xl p-8 text-center text-sm text-(--color-muted)">
        이벤트를 찾을 수 없습니다.
        <div className="mt-3">
          <Link to="/event" className="text-(--color-cyan)">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  const pct = Math.round(e.progress * 100);

  async function handleJoin() {
    try {
      const result = await join.mutateAsync(id);
      if (result.joined) appToast.raw.success("이벤트 참여 완료");
      else appToast.raw.info("이미 참여 중입니다");
    } catch {
      appToast.raw.error("참여에 실패했습니다");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/event" className="flex items-center gap-1 text-sm text-(--color-muted)">
        <ArrowLeft size={16} /> 이벤트
      </Link>

      <div
        className="relative overflow-hidden rounded-3xl p-6 shadow-depth-3"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${e.bgFrom} 45%, var(--color-bg-1)), color-mix(in oklab, ${e.bgTo} 45%, var(--color-bg-1)))`,
        }}
      >
        <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
          {e.status}
        </span>
        <h1 className="mt-3 text-2xl font-extrabold leading-tight">{e.title}</h1>
        <p className="mt-1 text-sm opacity-90">{e.tagline}</p>
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
          <Trophy size={14} className="text-gold" /> {e.rewardPreview}
        </div>
      </div>

      {e.status !== "종료" && (
        <div className="glass-3 grid grid-cols-4 gap-2 rounded-2xl p-3">
          {[
            ["일", cd.d],
            ["시간", cd.h],
            ["분", cd.m],
            ["초", cd.s],
          ].map(([l, v]) => (
            <div
              key={l as string}
              className="flex flex-col items-center rounded-xl bg-black/25 py-3"
            >
              <div className="font-numeric text-2xl font-extrabold tabular-nums">
                {String(v).padStart(2, "0")}
              </div>
              <div className="text-[10px] text-(--color-muted)">{l}</div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-2 rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-(--color-muted)">
            <Users size={12} />
            <span className="font-numeric">{e.participants.toLocaleString()}</span>명 참여
            {e.cap && (
              <span className="text-muted-2"> / {e.cap.toLocaleString()}</span>
            )}
          </span>
          <span className="font-numeric font-bold">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full bg-holographic transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="glass-2 rounded-2xl p-4">
        <h2 className="mb-2 text-sm font-bold">이벤트 안내</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-(--color-muted)">
          {e.body}
        </p>
      </div>

      {leaderboard.length > 0 && (
        <div className="glass-2 rounded-2xl p-4">
          <h2 className="mb-3 flex items-center gap-1 text-sm font-bold">
            <Crown size={14} className="text-gold" /> 실시간 리더보드
          </h2>
          <ul className="flex flex-col gap-1.5">
            {leaderboard.map((row) => (
              <li
                key={row.rank}
                className="flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-sm"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: row.rank <= 3 ? "var(--color-gold)" : "var(--color-surface-hi)",
                    color: row.rank <= 3 ? "var(--color-bg-0)" : "var(--color-foreground)",
                  }}
                >
                  {row.rank}
                </span>
                <span className="flex-1 truncate">{row.nickname}</span>
                <span className="font-numeric text-xs font-bold text-emerald">
                  +{row.score}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-2 rounded-2xl p-4">
        <h2 className="mb-2 text-sm font-bold">참여 약관</h2>
        <ul className="flex flex-col gap-1 text-xs text-(--color-muted)">
          {e.terms.map((t) => (
            <li key={t} className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-(--color-muted)" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => void handleJoin()}
        disabled={e.status === "종료" || join.isPending}
        className="sticky bottom-20 z-10 flex h-12 items-center justify-center gap-2 rounded-2xl bg-holographic text-sm font-bold text-(--color-bg-0) shadow-glow-purple disabled:opacity-50"
      >
        <Clock size={14} />
        {e.ctaLabel}
      </button>
    </div>
  );
}

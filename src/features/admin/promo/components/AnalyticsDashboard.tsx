import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ADMIN_KO, promoStatusLabel, PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";
import { Skeleton } from "@/components/ui/skeleton";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import {
  channelBreakdown,
  dailyDispatchBuckets,
  filterByPeriod,
  periodRange,
  resolveCampaignTitle,
  topCampaignByDispatches,
  topChannelFromClicks,
  type PeriodKey,
} from "@/lib/promo/analyticsAggregate";
import type { PromoCampaign, PromoDispatch } from "../types";

export function AnalyticsDashboard() {
  const { analytics, dispatches, clicks, campaigns, persisting, loading } = usePromoAdmin();
  const ko = ADMIN_KO.promo.analytics;

  const [period, setPeriod] = useState<PeriodKey>("7d");

  const { from, to } = useMemo(() => periodRange(new Date(), period), [period]);

  const filteredDispatches = useMemo(
    () => filterByPeriod(dispatches, (d) => d.sentAt, from, to),
    [dispatches, from, to],
  );
  const filteredClicks = useMemo(
    () => filterByPeriod(clicks, (c) => c.ts, from, to),
    [clicks, from, to],
  );

  const breakdown = useMemo(() => channelBreakdown(filteredDispatches), [filteredDispatches]);
  const buckets = useMemo(
    () => dailyDispatchBuckets(filteredDispatches, period === "30d" ? 30 : 7),
    [filteredDispatches, period],
  );
  const top = useMemo(
    () => topCampaignByDispatches(campaigns, filteredDispatches),
    [campaigns, filteredDispatches],
  );
  const periodTopChannel = useMemo(() => topChannelFromClicks(filteredClicks), [filteredClicks]);

  if (persisting && loading) {
    return <DashboardSkeleton />;
  }

  const filteredCount = filteredDispatches.length;
  const filteredClickCount = filteredClicks.length;
  const filteredImpressions = filteredCount * 100;
  const ctr =
    filteredImpressions > 0 ? (filteredClickCount / filteredImpressions) * 100 : 0;
  const isEmpty = filteredCount === 0 && filteredClickCount === 0;

  return (
    <section className="flex flex-col gap-4">
      <header className="glass-2 rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{ko.title}</h2>
            <p className="mt-1 text-[11px] text-(--color-muted)">
              {persisting ? ko.hintConfigured : ko.hint}
            </p>
          </div>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
      </header>

      <KpiRow
        impressions={filteredImpressions}
        clicks={filteredClickCount}
        ctr={ctr}
        dispatches={filteredCount}
        showDemoNote={!persisting}
      />

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChannelBreakdown rows={breakdown} />
            <TopCampaignCard
              top={top}
              topChannel={periodTopChannel ?? analytics.topChannel ?? null}
            />
          </div>
          <DispatchSparkline buckets={buckets} />
          <DispatchTimeline dispatches={filteredDispatches} campaigns={campaigns} />
        </>
      )}
    </section>
  );
}

function PeriodFilter({ value, onChange }: { value: PeriodKey; onChange: (v: PeriodKey) => void }) {
  const ko = ADMIN_KO.promo.analytics;
  const options: Array<{ key: PeriodKey; label: string }> = [
    { key: "7d", label: ko.period7d },
    { key: "30d", label: ko.period30d },
    { key: "all", label: ko.periodAll },
  ];
  return (
    <div className="glass-1 flex rounded-xl p-0.5 text-[11px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-label={`${ko.periodLabel} ${o.label}`}
          className={`rounded-lg px-2.5 py-1 ${value === o.key ? "bg-white/10 font-semibold" : "text-(--color-muted)"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KpiRow({
  impressions,
  clicks,
  ctr,
  dispatches,
  showDemoNote,
}: {
  impressions: number;
  clicks: number;
  ctr: number;
  dispatches: number;
  showDemoNote?: boolean;
}) {
  const ko = ADMIN_KO.promo.analytics;
  const cards = [
    { label: ko.impressions, value: impressions.toLocaleString("ko-KR") },
    {
      label: ko.clicks,
      value: clicks.toLocaleString("ko-KR"),
      note: showDemoNote ? ko.clicksScopeNote : undefined,
    },
    {
      label: ko.ctr,
      value: `${ctr.toFixed(2)}%`,
      note: showDemoNote ? ko.clicksScopeNote : undefined,
    },
    { label: ko.dispatches, value: dispatches.toLocaleString("ko-KR") },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="glass-1 rounded-2xl p-4">
          <div className="text-[10px] tracking-wide text-(--color-muted)">{c.label}</div>
          <div className="font-numeric mt-1 text-2xl font-extrabold">{c.value}</div>
          {c.note && <div className="mt-1 text-[9px] text-(--color-muted)">{c.note}</div>}
        </div>
      ))}
    </div>
  );
}

function ChannelBreakdown({
  rows,
}: {
  rows: Array<{ channel: string; count: number; pct: number }>;
}) {
  const ko = ADMIN_KO.promo.analytics;
  return (
    <div className="glass-2 rounded-3xl p-5">
      <h3 className="mb-3 text-sm font-bold">{ko.channelBreakdown}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-(--color-muted)">{ko.timelineEmpty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.channel} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span>{PROMO_CHANNEL_LABELS_KO[r.channel] ?? r.channel}</span>
                <span className="font-numeric text-(--color-muted)">
                  {r.count} ({(r.pct * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-(--color-accent)"
                  style={{ width: `${Math.round(r.pct * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopCampaignCard({
  top,
  topChannel,
}: {
  top: PromoCampaign | null;
  topChannel: string | null;
}) {
  const ko = ADMIN_KO.promo.analytics;
  return (
    <div className="glass-2 rounded-3xl p-5">
      <h3 className="mb-3 text-sm font-bold">{ko.topCampaign}</h3>
      <div className="text-base font-extrabold">{top?.title ?? ko.noTop}</div>
      <div className="mt-2 text-[11px] text-(--color-muted)">
        {ko.topChannelLabel}:{" "}
        <span className="font-semibold text-(--color-foreground)">
          {topChannel ? (PROMO_CHANNEL_LABELS_KO[topChannel] ?? topChannel) : ko.noTop}
        </span>
      </div>
    </div>
  );
}

function DispatchSparkline({ buckets }: { buckets: Array<{ ymd: string; count: number }> }) {
  const ko = ADMIN_KO.promo.analytics;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const w = 320;
  const h = 60;
  const stepX = buckets.length > 1 ? w / (buckets.length - 1) : 0;
  const points = buckets.map((b, i) => `${i * stepX},${h - (b.count / max) * h}`).join(" ");
  return (
    <div className="glass-2 rounded-3xl p-5">
      <h3 className="mb-3 text-sm font-bold">{ko.ctrTrend}</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="oklch(0.7 0.2 295)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-(--color-muted)">
        <span>{buckets[0]?.ymd}</span>
        <span>{buckets[buckets.length - 1]?.ymd}</span>
      </div>
    </div>
  );
}

function DispatchTimeline({
  dispatches,
  campaigns,
}: {
  dispatches: PromoDispatch[];
  campaigns: PromoCampaign[];
}) {
  const ko = ADMIN_KO.promo.analytics;
  const recent = [...dispatches]
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 20);
  return (
    <div className="glass-2 rounded-3xl p-5">
      <h3 className="mb-3 text-sm font-bold">{ko.timeline}</h3>
      {recent.length === 0 ? (
        <p className="text-xs text-(--color-muted)">{ko.timelineEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {recent.map((d) => (
            <li
              key={d.id}
              className="glass-1 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px]"
            >
              <span className="font-numeric w-28 shrink-0 text-(--color-muted)">
                {new Date(d.sentAt).toLocaleString("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="w-16 shrink-0 text-(--color-muted)">
                {PROMO_CHANNEL_LABELS_KO[d.channel] ?? d.channel}
              </span>
              <span className="flex-1 truncate">
                {resolveCampaignTitle(campaigns, d.campaignId)}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                  d.status === "failed"
                    ? "bg-(--color-rose)/20 text-(--color-rose)"
                    : d.status === "sent"
                      ? "bg-emerald/20 text-emerald"
                      : "bg-white/10 text-(--color-muted)"
                }`}
              >
                {promoStatusLabel(d.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  const ko = ADMIN_KO.promo.analytics;
  return (
    <div className="glass-2 flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
      <p className="text-sm font-semibold">{ko.emptyTitle}</p>
      <Link
        to="/admin/promo/channels"
        className="glass-1 rounded-xl px-3 py-1.5 text-xs hover:bg-white/5"
      >
        {ko.emptyCta}
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <Skeleton className="h-20 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </section>
  );
}

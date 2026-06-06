/**
 * GlobalFeedStream — live social feed (FOMO display only). Fixed viewport.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Heart, MessageCircle, Share2, Globe2 } from "lucide-react";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { formatPHON, formatCompact, formatUSDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { feedStreamStore } from "./FeedStreamStore";
import type { FeedPost, FeedCurrency } from "./FeedStreamStore";

const ROW_H = 104;
const ROW_GAP = 12;

function formatTimeAgo(ts: number, now: number): string {
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 3) return "방금";
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  return `${Math.floor(sec / 3600)}시간 전`;
}

function formatFeedReward(reward: number, currency: FeedCurrency): string {
  if (currency === "USDT") return `+${formatUSDT(reward)} USDT`;
  return `+${formatPHON(reward)} PHON`;
}

function rewardColor(currency: FeedCurrency): string {
  return currency === "USDT" ? "var(--color-emerald)" : "var(--color-gold)";
}

function FeedPostCard({ post, now, isNew }: { post: FeedPost; now: number; isNew: boolean }) {
  return (
    <Premium3DCard
      className={cn(
        "box-border shrink-0 overflow-hidden p-3",
        isNew &&
          "animate-feed-enter ring-1 ring-[color-mix(in_oklab,var(--color-cyan)_35%,transparent)]",
      )}
    >
      <div style={{ height: ROW_H }} className="flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-holographic text-[11px] font-bold text-(--color-bg-0)">
              {post.avatar}
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px] leading-none">
                {post.flag}
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{post.user}</div>
              <div className="text-[10px] text-(--color-muted)">{formatTimeAgo(post.ts, now)}</div>
            </div>
          </div>
          <div
            className="shrink-0 font-numeric text-xs font-bold leading-tight sm:text-sm"
            style={{ color: rewardColor(post.currency) }}
          >
            {formatFeedReward(post.reward, post.currency)}
          </div>
        </div>
        <p className="mt-1.5 line-clamp-1 text-sm leading-snug">{post.body}</p>
        <div className="mt-2 flex items-center gap-3 text-(--color-muted)">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] hover:text-pink"
          >
            <Heart size={12} /> {formatCompact(post.likes)}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] hover:text-(--color-cyan)"
          >
            <MessageCircle size={12} /> {formatCompact(post.comments)}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] hover:text-(--color-foreground)"
          >
            <Share2 size={12} /> Share
          </button>
        </div>
      </div>
    </Premium3DCard>
  );
}

interface Props {
  visible?: number;
  className?: string;
}

export function GlobalFeedStream({ visible = 4, className }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [latestId, setLatestId] = useState<string | null>(null);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(tick);
  }, []);

  const posts = useSyncExternalStore(
    feedStreamStore.subscribe,
    feedStreamStore.getPosts,
    feedStreamStore.getPosts,
  );

  const view = posts.slice(0, visible);
  const viewportH = visible * ROW_H + Math.max(0, visible - 1) * ROW_GAP;

  useEffect(() => {
    const id = posts[0]?.id ?? null;
    if (id && id !== latestId) setLatestId(id);
  }, [posts, latestId]);

  return (
    <section className={cn(className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-(--color-cyan)">
          <Globe2 size={12} />
          실시간 스트림
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-(--color-muted)">
          <span className="inline-flex h-1.5 w-1.5 animate-phon-pulse rounded-full bg-emerald" />
          {formatCompact(12_400 + Math.floor((now / 1000) % 2800))} posts/min · 10M+ users
        </span>
      </div>
      <div className="overflow-hidden" style={{ height: viewportH }}>
        <div className="flex flex-col gap-3">
          {view.map((p) => (
            <FeedPostCard key={p.id} post={p} now={now} isNew={p.id === latestId} />
          ))}
        </div>
      </div>
    </section>
  );
}

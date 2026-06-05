import { Heart, MessageCircle, Share2, TrendingUp } from "lucide-react";
import { OnlineCounterChip } from "@/shared/layout/OnlineCounterChip";
import { FomoMarquee } from "@/shared/motion/FomoMarquee";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { NoticeBar } from "@/features/notice/NoticeBar";
import { EventHero } from "@/features/event/EventHero";
import { MOCK_FEED_HOT } from "@/mocks/missions";
import { formatPHON } from "@/lib/format";
import { ModeToggle } from "@/shared/mode/ModeToggle";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";

export function FeedScreen() {
  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="🔥 PULSE"
        title="지금 폭주 중"
        description="전 세계에서 PHON이 터지고 있어요"
        right={<OnlineCounterChip compact />}
      />

      <ModeToggle />

      <NoticeBar />
      <EventHero />
      <FomoMarquee />
      <LiveCashoutStrip />
      <LiveBetsFeed limit={10} />

      {/* Hot strip */}
      <section>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pink">
          <TrendingUp size={12} /> 오늘의 핫 모먼트
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
          {MOCK_FEED_HOT.map((h) => (
            <Premium3DCard key={h.id} className="min-w-[180px] p-3" glow="gold">
              <div className="text-[11px] text-(--color-muted)">{h.name}</div>
              <div className="mt-1 text-sm font-semibold">{h.action}</div>
              <div className="mt-1 font-numeric text-base font-extrabold text-gold">
                +{formatPHON(h.amount)} PHON
              </div>
            </Premium3DCard>
          ))}
        </div>
      </section>

      {/* Stream */}
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-(--color-cyan)">
          실시간 스트림
        </div>
        {[
          {
            id: "p1",
            who: "포나라_드림",
            body: "오늘 출석 12일째! 보너스 +500 받고 시작 🚀",
            reward: 500,
          },
          {
            id: "p2",
            who: "민_차장",
            body: "크래시에서 18배 캐시아웃 성공 🔥 한 판 더 갑니다",
            reward: 940_000,
          },
          {
            id: "p3",
            who: "예슬_엄마",
            body: "육아하면서 한 달 누적 32만 PHON 모음. 이게 됩니다",
            reward: 320_000,
          },
          {
            id: "p4",
            who: "퇴근_요정",
            body: "친구 3명 초대로 즉시 15,000 PHON 입금됨",
            reward: 15_000,
          },
        ].map((p) => (
          <Premium3DCard key={p.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-holographic text-xs font-bold text-(--color-bg-0)">
                  {p.who.slice(0, 1)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{p.who}</div>
                  <div className="text-[10px] text-(--color-muted)">방금</div>
                </div>
              </div>
              <div className="font-numeric text-sm font-bold text-gold">
                +{formatPHON(p.reward)}
              </div>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed">{p.body}</p>
            <div className="mt-3 flex items-center gap-4 text-(--color-muted)">
              <button className="inline-flex items-center gap-1 text-xs">
                <Heart size={14} /> 1.2K
              </button>
              <button className="inline-flex items-center gap-1 text-xs">
                <MessageCircle size={14} /> 240
              </button>
              <button className="inline-flex items-center gap-1 text-xs">
                <Share2 size={14} /> 공유
              </button>
            </div>
          </Premium3DCard>
        ))}
      </section>
    </div>
  );
}

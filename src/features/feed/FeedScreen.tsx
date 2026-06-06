import { OnlineCounterChip } from "@/shared/layout/OnlineCounterChip";
import { FomoMarquee } from "@/shared/motion/FomoMarquee";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { NoticeBar } from "@/features/notice/NoticeBar";
import { EventHero } from "@/features/event/EventHero";
import { ModeToggle } from "@/shared/mode/ModeToggle";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { HotMomentsStrip } from "@/shared/livefeed/HotMomentsStrip";
import { GlobalFeedStream } from "@/shared/livefeed/GlobalFeedStream";
import { useFeedStreamBoot } from "@/shared/livefeed/useFeedStreamBoot";
import { useRegisterMainMode } from "@/shared/layout/useGameLayout";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { FeedRightRail } from "./FeedRightRail";

export function FeedScreen() {
  useRegisterMainMode("feed");
  const isDesktop = useDesktopLayout();
  useFeedStreamBoot();

  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="🔥 PULSE"
        title="지금 폭주 중"
        description="전 세계 1,000만+ 유저가 PHON을 벌고 있어요"
        right={<OnlineCounterChip compact />}
      />

      <ModeToggle />
      <NoticeBar />
      <EventHero />
      <FomoMarquee />
      {!isDesktop && <LiveCashoutStrip />}
      {!isDesktop && <LiveBetsFeed limit={10} />}
      <FeedRightRail />
      <HotMomentsStrip />
      <GlobalFeedStream visible={4} />
    </div>
  );
}

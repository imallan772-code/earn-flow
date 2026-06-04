import { Link } from "@tanstack/react-router";
import { Gift, ChevronRight, Sparkles, Gamepad2 } from "lucide-react";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { UrgencyBadge } from "@/shared/ui/UrgencyBadge";
import { StreakFlame } from "@/shared/motion/StreakFlame";
import { OnlineCounterChip } from "@/shared/layout/OnlineCounterChip";
import { MOCK_MISSIONS } from "@/mocks/missions";
import { MOCK_BALANCE } from "@/mocks/balance";
import { MOCK_GAMES } from "@/mocks/games";
import { formatPHON } from "@/lib/format";

export function EarnScreen() {
  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="💎 EARN"
        title="오늘의 미션"
        description="단 3초 만에 PHON이 쌓입니다"
        right={<OnlineCounterChip compact />}
      />

      {/* Streak + VIP banner */}
      <Premium3DCard className="flex items-center gap-4 p-4" glow="gold">
        <StreakFlame days={MOCK_BALANCE.streakDays} />
        <div className="flex-1">
          <div className="text-xs text-[var(--color-muted)]">연속 출석</div>
          <div className="text-lg font-extrabold">{MOCK_BALANCE.streakDays}일 째 🔥</div>
          <div className="mt-0.5 text-[11px] text-[var(--color-gold)]">7일마다 +500,000 PHON 보너스</div>
        </div>
        <UrgencyBadge text="TOP 0.01%" variant="hot" />
      </Premium3DCard>

      {/* Mission list */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-cyan)]">데일리 · 한정 미션</h2>
          <span className="text-[11px] text-[var(--color-muted)]">총 {MOCK_MISSIONS.length}개</span>
        </div>
        {MOCK_MISSIONS.map((m) => (
          <Premium3DCard key={m.id} className="flex items-center gap-3 p-3.5">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                background: "color-mix(in oklab, var(--color-purple) 14%, transparent)",
                color: "var(--color-purple)",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <div className="text-sm font-semibold">{m.title}</div>
                {m.urgency && (
                  <UrgencyBadge
                    text={m.urgency}
                    variant={m.kind === "viral" ? "seats" : "deadline"}
                  />
                )}
              </div>
              {m.progress != null && m.total != null && (
                <div className="mt-1.5 h-1 w-full rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-holographic"
                    style={{ width: `${Math.min(100, (m.progress / m.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-numeric text-sm font-extrabold text-[var(--color-gold)]">
                +{formatPHON(m.reward)}
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">PHON</div>
            </div>
          </Premium3DCard>
        ))}
      </section>

      {/* Mystery box */}
      <Premium3DCard className="flex items-center gap-3 p-4" glow="purple">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-holographic shadow-glow-purple">
          <Gift size={22} className="text-[var(--color-bg-0)]" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">오늘의 미스터리 박스</div>
          <div className="text-[11px] text-[var(--color-muted)]">최대 3,000,000 PHON · 일일 1회</div>
        </div>
        <button className="rounded-xl bg-holographic px-4 py-2 text-xs font-bold text-[var(--color-bg-0)]">열기</button>
      </Premium3DCard>

      {/* Game lobby preview */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-[var(--color-pink)]">
            <Gamepad2 size={14} /> 게임 로비
          </h2>
          <Link to="/earn/games" className="inline-flex items-center text-[11px] text-[var(--color-muted)]">
            전체 보기 <ChevronRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MOCK_GAMES.slice(0, 3).map((g) => (
            <Link
              key={g.slug}
              to="/earn/games/$slug"
              params={{ slug: g.slug }}
              className="glass-2 rounded-2xl p-3 text-center transition-transform active:scale-95"
            >
              <div className="text-xs font-semibold">{g.title}</div>
              <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{g.liveCount.toLocaleString()}명</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

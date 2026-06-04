import { useState } from "react";
import { Gift, Sparkles, Gamepad2, Target } from "lucide-react";
import { PremiumPageHeader } from "@/shared/ui/PremiumPageHeader";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { UrgencyBadge } from "@/shared/ui/UrgencyBadge";
import { StreakFlame } from "@/shared/motion/StreakFlame";
import { OnlineCounterChip } from "@/shared/layout/OnlineCounterChip";
import { SegmentedTabs } from "@/shared/ui/SegmentedTabs";
import { GameLobby } from "@/features/games/GameLobby";
import { MOCK_MISSIONS } from "@/mocks/missions";
import { MOCK_BALANCE } from "@/mocks/balance";
import { formatPHON } from "@/lib/format";
import { t } from "@/shared/i18n";
import { appToast } from "@/shared/ui/toast";

type EarnTab = "missions" | "games";

export function EarnScreen() {
  const [tab, setTab] = useState<EarnTab>("missions");

  return (
    <div className="flex flex-col gap-4">
      <PremiumPageHeader
        eyebrow="💎 EARN"
        title="오늘의 미션"
        description="단 3초 만에 PHON이 쌓입니다"
        right={<OnlineCounterChip compact />}
      />

      <SegmentedTabs<EarnTab>
        value={tab}
        onChange={setTab}
        layoutId="earn-tab-pill"
        items={[
          {
            id: "missions",
            label: t("earn.tab.missions"),
            sub: t("earn.tab.missions.sub"),
            icon: <Target size={16} />,
          },
          {
            id: "games",
            label: t("earn.tab.games"),
            sub: t("earn.tab.games.sub"),
            icon: <Gamepad2 size={16} />,
          },
        ]}
      />

      {tab === "missions" && (
        <>
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

          {/* Mystery box (보너스성 → 미션 탭에 흡수) */}
          <Premium3DCard className="flex items-center gap-3 p-4" glow="purple">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-holographic shadow-glow-purple">
              <Gift size={22} className="text-[var(--color-bg-0)]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">오늘의 미스터리 박스</div>
              <div className="text-[11px] text-[var(--color-muted)]">최대 3,000,000 PHON · 일일 1회</div>
            </div>
            <button
              onClick={() => appToast.box.opened({ amount: formatPHON(1_250_000) })}
              className="rounded-xl bg-holographic px-4 py-2 text-xs font-bold text-[var(--color-bg-0)]"
            >
              열기
            </button>
          </Premium3DCard>
        </>
      )}

      {tab === "games" && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-[var(--color-pink)]">
              <Gamepad2 size={14} /> 게임 로비
            </h2>
            <span className="text-[11px] text-[var(--color-muted)]">8게임 · Provably Fair</span>
          </div>
          <GameLobby />
        </section>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { Sparkles, Zap, Gift, ArrowRight, ShieldCheck } from "lucide-react";
import { FloatingOrbs } from "@/shared/layout/FloatingOrbs";
import { OnlineCounterChip } from "@/shared/layout/OnlineCounterChip";
import { FomoMarquee } from "@/shared/motion/FomoMarquee";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { LiveNumber } from "@/shared/motion/LiveNumber";
import { CountUp } from "@/shared/motion/CountUp";
import { useLiveOnline } from "@/shared/motion/liveOnlineStore";
import { MOCK_LANDING_HERO_STATS, MOCK_EVENT_BONUS_PERCENT } from "@/mocks/fomo";

const accentColor = {
  cyan: "var(--color-cyan)",
  purple: "var(--color-purple)",
  pink: "var(--color-pink)",
  gold: "var(--color-gold)",
} as const;

const KO = new Intl.NumberFormat("ko-KR");

function formatManlike(n: number, suffix = "") {
  // 1,012만+ 형식
  const man = Math.round(n / 10_000);
  return `${KO.format(man)}만${suffix}`;
}
function formatEok(n: number, suffix = "") {
  // 12.4억+ 형식
  const eok = n / 100_000_000;
  const fixed = eok >= 10 ? eok.toFixed(1) : eok.toFixed(2);
  return `${fixed}억${suffix}`;
}

export function Landing() {
  const liveOnline = useLiveOnline();
  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-cosmic">
      <FloatingOrbs />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-6 safe-top lg:max-w-6xl lg:px-10 lg:pb-12 lg:pt-8">
        {/* Brand row */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-holographic shadow-glow-purple lg:h-11 lg:w-11">
              <Sparkles size={18} className="text-(--color-bg-0)" strokeWidth={2.6} />
            </div>
            <span className="text-base font-extrabold tracking-tight lg:text-xl">PHONARA</span>
          </div>
          <OnlineCounterChip compact />
        </div>

        {/* Desktop: 세로 중앙 블록 — 모바일은 기존 위→아래 흐름 */}
        <div className="mt-5 flex flex-1 flex-col justify-center gap-5 lg:mt-0 lg:gap-10 lg:py-10">
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12">
            {/* Hero + CTAs */}
            <div className="flex flex-col gap-5">
              <section className="mt-2 lg:mt-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-(--color-cyan) lg:text-sm">
                  🔥 오늘만 {MOCK_EVENT_BONUS_PERCENT}% 보너스 이벤트
                </div>
                <h1 className="mt-2 text-[34px] font-extrabold leading-[1.08] lg:text-5xl lg:leading-[1.06]">
                  매일 들어와서
                  <br />
                  <span className="text-holographic">진짜 돈 버는 곳.</span>
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-(--color-muted) lg:mt-4 lg:max-w-xl lg:text-base">
                  글로벌 매일 출석·미션·게임으로 PHON을 모아 KRW/USDT로 인출합니다. 가입 즉시{" "}
                  <span className="font-semibold text-gold">5,000 PHON+</span>
                </p>
              </section>

              <div className="flex gap-2.5 lg:max-w-md">
                <Link
                  to="/signup"
                  className="group flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-holographic font-bold text-(--color-bg-0) shadow-glow-purple lg:h-16 lg:text-base"
                >
                  지금 무료 시작
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  to="/login"
                  className="glass-2 flex h-14 items-center justify-center rounded-2xl px-5 text-sm font-semibold lg:h-16 lg:px-6"
                >
                  로그인
                </Link>
              </div>
            </div>

            {/* Hero stats — FOMO */}
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
              {MOCK_LANDING_HERO_STATS.map((s) => {
                const fmt =
                  s.live?.mode === "manlike"
                    ? (n: number) => formatManlike(n, s.live!.suffix ?? "")
                    : s.live?.mode === "eok"
                      ? (n: number) => formatEok(n, s.live!.suffix ?? "")
                      : (n: number) => KO.format(Math.round(n));
                return (
                  <Premium3DCard key={s.label} className="p-3 lg:p-4">
                    <div className="type-caption">{s.label}</div>
                    <div
                      className="mt-1 font-numeric text-xl font-extrabold lg:text-2xl"
                      style={{ color: accentColor[s.accent] }}
                    >
                      {s.syncKey === "globalOnline" ? (
                        <CountUp value={liveOnline} duration={1400} format={fmt} />
                      ) : s.live ? (
                        <LiveNumber
                          base={s.live.base}
                          amplitudeRatio={s.live.amplitudeRatio}
                          bias={s.live.bias}
                          format={fmt}
                        />
                      ) : (
                        s.staticValue
                      )}
                    </div>
                    <div className="mt-0.5 type-caption">{s.sub}</div>
                  </Premium3DCard>
                );
              })}
            </div>
          </div>

          {/* Marquee */}
          <FomoMarquee />

          {/* Live cashout */}
          <LiveCashoutStrip />

          {/* Value pillars */}
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3 lg:gap-4">
            <Premium3DCard className="flex items-center gap-3 p-4" glow="cyan">
              <Zap size={22} style={{ color: "var(--color-cyan)" }} />
              <div>
                <div className="text-sm font-semibold">3초 시작 · 직장인·주부·대학생 누구나</div>
                <div className="text-xs text-(--color-muted)">가입하자마자 첫 보상 떨어집니다</div>
              </div>
            </Premium3DCard>
            <Premium3DCard className="flex items-center gap-3 p-4" glow="gold">
              <Gift size={22} style={{ color: "var(--color-gold)" }} />
              <div>
                <div className="text-sm font-semibold">매일 출석 · 미션 · 게임 = PHON</div>
                <div className="text-xs text-(--color-muted)">KRW · USDT로 즉시 환전</div>
              </div>
            </Premium3DCard>
            <Premium3DCard className="flex items-center gap-3 p-4" glow="purple">
              <ShieldCheck size={22} style={{ color: "var(--color-purple)" }} />
              <div>
                <div className="text-sm font-semibold">투명한 정산 · 24/7 지원</div>
                <div className="text-xs text-(--color-muted)">글로벌 운영팀 24/7 운영</div>
              </div>
            </Premium3DCard>
          </div>
        </div>

        <div className="mt-auto shrink-0 pt-6 text-center type-caption lg:pt-8">
          © PHONARA · Visual Lab Preview
        </div>
      </div>
    </div>
  );
}

// Visual Lab mock SSOT — Cursor `viral-display.ts`로 강화 병합 (축소 금지)

export const MOCK_ONLINE_BASE = 10_048_293;
export const MOCK_CONCURRENT_PEAK = 327_412; // 32만 명 동시 접속
export const MOCK_EVENT_BONUS_PERCENT = 150;
export const MOCK_TOTAL_PAID_TODAY_PHON = 1_240_000_000;
export const MOCK_REALTIME_CASHOUT_KRW = 5_290_000;

export interface MarqueeRow {
  id: string;
  text: string;
  accent: "cyan" | "purple" | "pink" | "gold";
}

export const MOCK_MARQUEE_ROWS: MarqueeRow[] = [
  { id: "m1", text: "🔥 김** 님이 방금 1,240,000 PHON 출금 완료", accent: "gold" },
  { id: "m2", text: "⚡ 지금 32만 명이 동시에 PHONARA에서 돈 벌고 있어요", accent: "cyan" },
  { id: "m3", text: "💎 박** 님 크래시 27.4× 캐시아웃 성공", accent: "purple" },
  { id: "m4", text: "🎁 오늘만 150% 보너스 — 마감 임박", accent: "pink" },
  { id: "m5", text: "🚀 이** 님 슬롯에서 잭팟 8,400,000 PHON", accent: "gold" },
  { id: "m6", text: "💸 지금 1,012만+ 명이 PHONARA에 접속 중", accent: "cyan" },
  { id: "m7", text: "🏆 TOP 0.01% VIP 승급 폭주", accent: "purple" },
  { id: "m8", text: "🎯 최** 님 출석 30일 연속 — +500,000 PHON 보너스", accent: "gold" },
  { id: "m9", text: "🔥 럭키박스 레전더리 드랍 12건 발생", accent: "pink" },
  { id: "m10", text: "⏳ 한정 미션 남은 자리 47석", accent: "cyan" },
  { id: "m11", text: "💰 정** 님 룰렛 35배 적중", accent: "purple" },
  { id: "m12", text: "🇰🇷 한국 사용자 1,012만+ 돌파", accent: "gold" },
];

export interface CashoutTick {
  id: string;
  name: string;
  amount: number;
  multiplier?: number;
}

export const MOCK_CASHOUT_FEED: CashoutTick[] = [
  { id: "c1", name: "김**", amount: 1_240_000, multiplier: 12.4 },
  { id: "c2", name: "박**수", amount: 480_000, multiplier: 4.8 },
  { id: "c3", name: "이**", amount: 2_140_000, multiplier: 27.4 },
  { id: "c4", name: "최**경", amount: 320_000, multiplier: 3.2 },
  { id: "c5", name: "정**", amount: 8_400_000, multiplier: 84.0 },
  { id: "c6", name: "강**", amount: 720_000, multiplier: 7.2 },
  { id: "c7", name: "윤**호", amount: 1_900_000, multiplier: 19.0 },
  { id: "c8", name: "조**", amount: 540_000, multiplier: 5.4 },
];

export interface LandingHeroStat {
  label: string;
  accent: "cyan" | "gold" | "pink" | "purple";
  sub: string;
  /** Live-animated numeric value */
  live?: { base: number; amplitudeRatio: number; bias: number; suffix?: string; prefix?: string; mode: "manlike" | "eok" | "raw" | "percent" };
  /** Sync with a global shared store (e.g. global online counter) */
  syncKey?: "globalOnline";
  /** Static display (when no live) */
  staticValue?: string;
}

export const MOCK_LANDING_HERO_STATS: LandingHeroStat[] = [
  {
    label: "전 세계 실시간 접속",
    accent: "cyan",
    sub: "지금 폭주 중",
    live: { base: MOCK_ONLINE_BASE, amplitudeRatio: 0.003, bias: 0.52, mode: "manlike", suffix: "+" },
    syncKey: "globalOnline",
  },
  {
    label: "오늘 지급된 PHON",
    accent: "gold",
    sub: "마감까지 남은 시간",
    live: { base: 1_240_000_000, amplitudeRatio: 0.005, bias: 0.62, mode: "eok", suffix: "+" },
  },
  {
    label: "이벤트 보너스",
    accent: "pink",
    sub: "오늘만",
    staticValue: `+${MOCK_EVENT_BONUS_PERCENT}%`,
  },
];


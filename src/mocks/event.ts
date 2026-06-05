export type EventStatus = "진행중" | "예정" | "종료";

export interface AppEvent {
  id: string;
  status: EventStatus;
  title: string;
  tagline: string;
  body: string;
  rewardPreview: string;
  startsAt: string;
  endsAt: string;
  progress: number; // 0..1
  participants: number;
  cap?: number;
  ctaLabel: string;
  terms: string[];
  leaderboard?: { rank: number; nickname: string; score: number }[];
  bgFrom: string; // CSS color token
  bgTo: string;
}

export const EVENTS: AppEvent[] = [
  {
    id: "e-300-bonus",
    status: "진행중",
    title: "오늘만 300% 가입 보너스",
    tagline: "TOP 0.01%만 받는 특별 적립",
    body: "오늘 24시까지 가입한 신규 회원에게 PHON 300%를 즉시 적립합니다. 첫 출금 시 100% 보장.",
    rewardPreview: "최대 30,000 PHON",
    startsAt: "2026-06-04T00:00:00+09:00",
    endsAt: "2026-06-04T23:59:59+09:00",
    progress: 0.72,
    participants: 84_281,
    cap: 100_000,
    ctaLabel: "지금 받기",
    terms: ["신규 가입자 한정", "1인 1회", "출금 시 KYC 필요"],
    bgFrom: "var(--color-purple)",
    bgTo: "var(--color-pink)",
  },
  {
    id: "e-trade-rank",
    status: "진행중",
    title: "선물 거래 랭킹전 시즌3",
    tagline: "총 상금 50,000 USDT",
    body: "수익률 기준 TOP 100에게 USDT 분배. 매일 자정 정산.",
    rewardPreview: "1위 10,000 USDT",
    startsAt: "2026-06-01T00:00:00+09:00",
    endsAt: "2026-06-30T23:59:59+09:00",
    progress: 0.18,
    participants: 12_402,
    ctaLabel: "참여하기",
    terms: ["선물 거래량 1,000 USDT 이상", "ROI 기준 정산"],
    leaderboard: [
      { rank: 1, nickname: "팬텀트레이더", score: 482.31 },
      { rank: 2, nickname: "코인사신", score: 391.04 },
      { rank: 3, nickname: "롱숏의신", score: 287.55 },
      { rank: 4, nickname: "야수의심장", score: 244.1 },
      { rank: 5, nickname: "BTC왕", score: 211.78 },
    ],
    bgFrom: "var(--color-cyan)",
    bgTo: "var(--color-purple)",
  },
  {
    id: "e-attendance-season",
    status: "진행중",
    title: "28일 출석 시즌 미션",
    tagline: "끝까지 출석하면 1만원 즉시 송금",
    body: "28일 연속 출석 시 10,000원 KRW 즉시 송금. 중간 보상도 풍성.",
    rewardPreview: "10,000원 + 보너스 PHON",
    startsAt: "2026-05-15T00:00:00+09:00",
    endsAt: "2026-06-11T23:59:59+09:00",
    progress: 0.85,
    participants: 482_103,
    ctaLabel: "출석하기",
    terms: ["일 1회 출석 인정", "연속 끊기면 처음부터"],
    bgFrom: "var(--color-gold)",
    bgTo: "var(--color-pink)",
  },
  {
    id: "e-keepy-uppy-cup",
    status: "예정",
    title: "Keepy-Uppy 월드컵",
    tagline: "공차기 챔피언에게 PHON 100만",
    body: "신규 게임 Keepy-Uppy 정식 토너먼트. 64강 → 결승 토너먼트.",
    rewardPreview: "우승 1,000,000 PHON",
    startsAt: "2026-06-15T20:00:00+09:00",
    endsAt: "2026-06-20T23:00:00+09:00",
    progress: 0,
    participants: 3_204,
    ctaLabel: "사전 신청",
    terms: ["계정 1개당 1회", "랭킹전 점수 기준 시드"],
    bgFrom: "var(--color-emerald)",
    bgTo: "var(--color-cyan)",
  },
  {
    id: "e-may-attendance",
    status: "종료",
    title: "5월 출석 시즌 보상 정산 완료",
    tagline: "총 PHON 8.2억 지급",
    body: "5월 시즌 보상 정산이 완료되었습니다. My > 거래내역에서 확인 가능합니다.",
    rewardPreview: "지급 완료",
    startsAt: "2026-05-01T00:00:00+09:00",
    endsAt: "2026-05-31T23:59:59+09:00",
    progress: 1,
    participants: 824_910,
    ctaLabel: "내역 보기",
    terms: ["정산 종료"],
    bgFrom: "var(--color-muted-2)",
    bgTo: "var(--color-surface-hi)",
  },
];

export function getEventById(id: string): AppEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

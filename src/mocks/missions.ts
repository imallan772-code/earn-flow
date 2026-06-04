export interface MockMission {
  id: string;
  title: string;
  reward: number;
  kind: "daily" | "limited" | "viral" | "onboarding";
  urgency?: string;
  progress?: number;
  total?: number;
}

export const MOCK_MISSIONS: MockMission[] = [
  { id: "m-att", title: "오늘 출석하기", reward: 100, kind: "daily", progress: 0, total: 1, urgency: "마감 4시간" },
  { id: "m-feed", title: "피드 글 10개 좋아요", reward: 200, kind: "daily", progress: 4, total: 10 },
  { id: "m-game", title: "게임 3판 플레이", reward: 500, kind: "daily", progress: 1, total: 3 },
  { id: "m-vir-1", title: "친구 1명 초대 — 즉시 +5,000 PHON", reward: 5_000, kind: "viral", urgency: "남은 자리 47석" },
  { id: "m-lim-1", title: "한정 미스터리박스 오픈", reward: 3_000, kind: "limited", urgency: "마감 임박 ⏳" },
  { id: "m-lim-2", title: "TOP 0.01% VIP 챌린지", reward: 50_000, kind: "limited", urgency: "오늘만" },
];

export const MOCK_FEED_HOT = [
  { id: "h1", name: "김**", action: "크래시 27.4× 캐시아웃", amount: 2_140_000 },
  { id: "h2", name: "박**수", action: "슬롯 잭팟 적중", amount: 8_400_000 },
  { id: "h3", name: "이**", action: "30일 연속 출석 보너스", amount: 500_000 },
  { id: "h4", name: "최**경", action: "친구 초대 5명 완료", amount: 25_000 },
  { id: "h5", name: "정**", action: "럭키박스 레전더리 드랍", amount: 1_800_000 },
];

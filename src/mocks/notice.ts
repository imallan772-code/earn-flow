export type NoticeCategory = "공지" | "업데이트" | "점검" | "보안";

export interface Notice {
  id: string;
  category: NoticeCategory;
  title: string;
  excerpt: string;
  body: string;
  pinned: boolean;
  publishedAt: string; // ISO
  author: string;
  attachments?: { name: string; size: string }[];
}

export const NOTICES: Notice[] = [
  {
    id: "n-2026-06-01",
    category: "공지",
    title: "PHONARA 2.0 정식 오픈 — 300% 가입 보너스",
    excerpt: "오늘 가입하시면 PHON 300%를 즉시 적립해 드립니다. 단, 오늘만!",
    body: "PHONARA 2.0이 정식 오픈했습니다.\n\n· 300% 가입 보너스 (오늘 24시까지)\n· 출석 7일 streak 보너스 2배\n· 신규 게임 8종 동시 오픈\n\n지금 바로 시작하세요.",
    pinned: true,
    publishedAt: "2026-06-04T09:00:00+09:00",
    author: "PHONARA 운영팀",
    attachments: [{ name: "이용약관_v2.pdf", size: "412KB" }],
  },
  {
    id: "n-2026-06-03",
    category: "보안",
    title: "보안 강화 안내 — 2FA 의무화",
    excerpt: "6월 15일부터 출금 시 2FA가 의무화됩니다.",
    body: "안전한 자산 보호를 위해 출금 시 2FA(이중 인증)가 의무화됩니다. 미설정 계정은 출금이 제한됩니다.",
    pinned: true,
    publishedAt: "2026-06-03T18:00:00+09:00",
    author: "보안팀",
  },
  {
    id: "n-2026-06-02",
    category: "업데이트",
    title: "선물 거래 — 125x 레버리지 오픈",
    excerpt: "Bybit급 선물 터미널이 정식 런칭되었습니다.",
    body: "Hedge / One-way 모드, Cross / Isolated 마진, Multi-Asset Mode, Sub-account 모두 지원합니다.",
    pinned: false,
    publishedAt: "2026-06-02T12:00:00+09:00",
    author: "거래소팀",
  },
  {
    id: "n-2026-06-01b",
    category: "점검",
    title: "정기 점검 안내 (6/10 03:00~04:00)",
    excerpt: "약 1시간 동안 입출금이 일시 중단됩니다.",
    body: "6월 10일 새벽 3시부터 4시까지 정기 점검을 진행합니다. 거래는 정상 작동, 입출금만 일시 중단됩니다.",
    pinned: false,
    publishedAt: "2026-06-01T10:00:00+09:00",
    author: "운영팀",
  },
  {
    id: "n-2026-05-30",
    category: "공지",
    title: "친구초대 보상 다단계 시즌2 시작",
    excerpt: "3단계 다단계 리워드로 업그레이드되었습니다.",
    body: "1단계 10% / 2단계 3% / 3단계 1% 평생 리워드. 만원 송금 마일스톤 동시 진행.",
    pinned: false,
    publishedAt: "2026-05-30T15:00:00+09:00",
    author: "운영팀",
  },
  {
    id: "n-2026-05-28",
    category: "업데이트",
    title: "Keepy-Uppy(공차기) 게임 추가",
    excerpt: "틱톡 공차기 스타일 미니게임이 추가되었습니다.",
    body: "콤보 ×2/×5/×10 시스템, 리더보드 시즌제 운영.",
    pinned: false,
    publishedAt: "2026-05-28T11:00:00+09:00",
    author: "게임팀",
  },
];

export function getNoticeById(id: string): Notice | undefined {
  return NOTICES.find((n) => n.id === id);
}

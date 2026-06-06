/** Admin UI 한글 라벨 SSOT (web /admin + promo) */

export const ADMIN_KO = {
  shell: {
    title: "PHONARA 운영",
    subtitle: "1인 운영 콘솔 · phonara-gb",
    backToAdmin: "← 운영 홈",
    userApp: "사용자 앱",
  },
  nav: {
    dashboard: "대시보드",
    notice: "공지",
    event: "이벤트",
    promo: "프로모",
  },
  promo: {
    title: "PHONARA · 프로모 스튜디오",
    subtitle: "데모 모드 · 실제 발행·AI는 Z-1 이후",
    tabs: {
      studio: "스튜디오",
      campaigns: "캠페인",
      calendar: "캘린더",
      channels: "채널",
      assets: "에셋",
      analytics: "분석",
      settings: "설정",
    },
    status: {
      draft: "초안",
      scheduled: "예약",
      publishing: "발행 중",
      done: "완료",
      failed: "실패",
    },
    dispatchStatus: {
      sent: "발송됨",
      failed: "실패",
      queued: "대기",
    },
    studio: {
      composer: "AI 카피 작성",
      composerHint: "Brief를 입력하고 「카피 생성」을 눌러 5개 채널 카피를 한 번에 만드세요.",
      composerHintConfigured: "AI 연결됨 · 캠페인은 로컬 데모로 저장됩니다.",
      composerHintFallback: "AI 미연결 — 키 등록 전엔 로컬 fallback 카피가 표시됩니다.",
      livePreview: "실시간 미리보기",
      generate: "카피 생성",
      generating: "생성 중…",
      cancel: "취소",
      save: "캠페인 저장",
      titlePh: "캠페인 제목",
      briefPh: "홍보 내용 — 대상, 톤, 핵심 메시지",
      urlPh: "랜딩 URL (https://…)",
      previewEmpty: "「카피 생성」을 누르면 채널별 미리보기가 표시됩니다.",
      campaignCount: (n: number) => `저장된 캠페인 ${n}개 (로컬 데모)`,
      variantCard: {
        weight: "비중",
        bodyPh: "본문",
        hashtagsPh: "#태그 #공백구분",
        ctaPh: "행동 유도 문구",
        imagePromptPh: "이미지 프롬프트 (선택, Z-2에서 생성)",
      },
    },
    campaigns: {
      title: "캠페인 목록",
      empty: "캠페인이 없습니다. 스튜디오에서 만들어 주세요.",
      delete: "삭제",
    },
    calendar: {
      title: "발행 일정",
      hint: "예약 시각을 바꾸면 즉시 반영됩니다. (Supabase 연동은 Z-DB 이후)",
      empty: "등록된 캠페인이 없습니다.",
    },
    channels: {
      title: "채널 매트릭스",
      logTitle: "발송 로그",
      logMeta: (dispatches: number, tests: number) =>
        `발송 기록 ${dispatches}건 · 테스트 ${tests}건`,
      verify: "연결 확인",
      send: "테스트 발행",
      mockBadge: "데모",
    },
    assets: {
      title: "에셋 라이브러리",
      addPlaceholder: "플레이스홀더 추가",
      empty: "에셋이 없습니다.",
      kind: { image: "이미지", video: "영상", copy: "카피" },
    },
    analytics: {
      title: "성과 분석",
      hint: "데모 집계 · Supabase 연동 후 실클릭 데이터로 전환",
      impressions: "노출(추정)",
      clicks: "클릭",
      ctr: "클릭률",
      dispatches: "발송",
    },
    settings: {
      title: "프로모 설정",
      hint: "데모 모드에서는 브라우저에만 저장됩니다. 운영 secret은 배포 환경 변수에 등록하세요.",
      webhook: "Zapier Webhook URL",
      hmac: "Cron HMAC Secret",
      utm: "기본 utm_source",
    },
    risk: {
      label: (score: number) => `리스크 ${score}`,
      noFlags: "특이사항 없음",
      localLabel: "로컬",
      aiLabel: "AI",
      mergedHint: "병합",
      low: "낮음",
      mid: "주의",
      high: "위험",
    },
    ai: {
      configured: "AI 연결됨",
      notConfigured: "AI 미연결 (fallback)",
      providerGemini: "Gemini Flash (무료)",
      providerGateway: "Lovable Gateway",
      subtitleConfigured: (provider: string) =>
        `${provider} 연결 · 캠페인은 로컬 데모로 저장됩니다.`,
      subtitleFallback: "AI 미연결 · 로컬 fallback 카피만 표시",
    },
    errors: {
      notConfigured: "AI 키가 없어 로컬 fallback 카피를 표시했습니다.",
      rateLimited: "AI 요청 한도 초과 — 잠시 후 다시 시도하세요.",
      gatewayError: "AI 호출 실패 — 로컬 fallback으로 대체했습니다.",
      timeout: "AI 응답이 지연되어 fallback으로 대체했습니다.",
      parseError: "AI 응답 형식 오류 — fallback으로 대체했습니다.",
      emptyBrief: "Brief를 입력해 주세요.",
      generic: "오류가 발생했습니다.",
    },
  },
} as const;

export const PROMO_CHANNEL_LABELS_KO: Record<string, string> = {
  telegram: "텔레그램",
  discord: "디스코드",
  slack: "슬랙",
  x: "X (트위터)",
  linkedin: "링크드인",
  tiktok: "틱톡",
  resend: "이메일 (Resend)",
  zapier: "Zapier 웹훅",
  copy: "복사 모드 (네이버·카카오·IG)",
};

export function promoStatusLabel(status: string): string {
  const map = ADMIN_KO.promo.status as Record<string, string>;
  return map[status] ?? status;
}

export function promoDispatchLabel(status: string): string {
  const map = ADMIN_KO.promo.dispatchStatus as Record<string, string>;
  return map[status] ?? status;
}

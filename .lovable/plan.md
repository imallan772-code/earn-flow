# 진짜 마지막 끝판왕 플랜 (Final Boss Edition v2)

## 스택 (확정)
TanStack Start v1 · React 19 · TS strict · Tailwind v4 · Framer Motion · @tradingview/lightweight-charts · Canvas 2D + Web Workers · Vite PWA · Supabase(RLS/RPC/Realtime/Edge) · pnpm monorepo(apps/web + apps/admin)

**역할 분담**
- **Lovable**: UI 100% · 게임 결정론 엔진 · 어댑터 인터페이스 · PWA shell · 라우팅 · 디자인 시스템 · 어드민 UI · 공지/이벤트
- **Cursor**: Supabase 실연결 · monorepo 분할 · OAuth/KYC/USDT HD 지갑 · FCM

---

## Part 1 — 네이밍 (글로벌 전환)
폴더 `kebab-case` · 컴포넌트 `PascalCase` · 훅 `useCamelCase` · 어댑터 `<domain>Adapter` · RPC `snake_case` · 라우트 flat dot · 토큰 `--color-<role>` · 이벤트 `<domain>_<action>` · i18n `<area>.<element>.<state>` · 통화 ISO 4217

## Part 2 — 디자인 시스템
- 폰트: Urbanist / Epilogue / JetBrains Mono
- Tailwind v4 `@theme` — glass-1/2/3 · bg-cosmic · bg-holographic · ring-aurora-live
- View Transitions API · Light/Dark/System + 5 액센트 + 색맹 모드
- 모든 색 oklch · 컴포넌트 직접 색상 금지

## Part 3 — Shell & Routing
- Mobile: `max-w-md` + 5탭 BottomNav (Pulse / Earn / Trade / Notice / My)
- Tablet 64px sidebar · Desktop 240px sidebar + RightRail
- Trade: `/exchange/$symbol` · Notice: `/notice` · Event: `/event`

## Part 4 — 트레이딩 (Binance/Bybit 1:1)
- **Spot**: TradingChart · OrderBook 20단계 · TradesTape 100rows · OrderTicket(Iceberg/Scaled/Bracket) · MarketsList
- **Futures**: 125× · Cross/Isolated · Hedge/One-way · WASM 청산가 · Multi-Asset/Portfolio Margin/Sub-accounts
- **고급**: DepthChart · Heatmap · LiquidationsStream · LongShortRatio · OpenInterest · WhaleAlert
- **Earn 8종** + **Bots**(Grid/DCA)

## Part 5 — 입출금 (PG 미사용)
USDT TRC20/ERC20 자동매칭 · KRW 무통장(30분 카운트다운 + deposit_code) · 상품권 OCR mock · 일일한도 · KYC 게이트 · 채널비교카드

## Part 6 — 게임 8종 (Stake.com 1:1, 0프레임 오차)
공통 `<StakeBetPanel>` + 결정론 엔진:
```
mulberry32(seed) → Math.floor(v*1e6)/1e6 → actual >= target - 1e-9
```
- **Crash** 자동 캐쉬아웃 `2.000000` 정확
- **Dice** 0.00~99.99 · 1% 엣지 · SHA256 provably fair
- **Slots / Roulette / RPS / LuckyBox / CardFlip**
- **Keepy-Uppy (틱톡 공차기)** 30Hz worker 물리 + 60fps main · 콤보 ×2/×5/×10 · 리더보드
- Canvas 2D + 단일 RAF

## Part 7 — 한국 앱테크 (1위 무기)
출석 7일 streak · 28일 시즌 · 만보기(1000/5000/100000 잭팟) · 잠금화면 광고 · 럭키쿠키 · 럭키룰렛 · 카카오톡/SNS 공유 · 친구초대 다단계 · 시청 미션 · CashShop · 캐시백 · 만원 송금 마일스톤 · VIP · 타임어택 · 콤보
*(보상형 비디오/설문/영수증/리뷰 — 제외)*

## Part 8 — 공지/이벤트 탭 (신규)
- `/notice` — 카테고리(공지/업데이트/점검/보안) · 핀고정 · 읽음표시 · 검색 · 페이지네이션
- `/notice/$id` — 상세(MDX 렌더 mock) · 첨부 · 공유
- `/event` — 진행중/예정/종료 탭 · 카드그리드 · 카운트다운 · 참여버튼 · 보상미리보기 · 진행률바
- `/event/$id` — 상세 · 약관 · 진행률 · 리더보드 mock
- 홈 Pulse 상단에 NoticeBar(슬라이드) + EventHero 캐러셀
- 어드민에서 CRUD + 예약발행 + 푸시연동 mock

## Part 9 — FOMO 극강
RollingCountUp `1,012만+` · 2-row GPU marquee · LiveCashoutStrip · BigWinTicker · 한글 이모지 타일 · "300% 보너스 · 오늘만 · TOP 0.01%" · 내부 디바이스명 노출 금지

## Part 10 — 어드민 (1인 운영 99%)
14페이지: Dashboard(KPI 8) · 입금큐 · 출금큐 · 유저 · STR · 위험탐지 · 콘텐츠 · 피처플래그 · 수수료/한도 · 미션 · 게임운영 · 알림 · **공지** · **이벤트**

## Part 11 — 어댑터 이식 게이트
`src/adapters/*.ts` 22개 — Cursor에서 import path 1줄 교체로 실 Supabase 연결
`authAdapter · walletAdapter · tradeAdapter · gameAdapter · missionAdapter · realtimeAdapter · kycAdapter · notifyAdapter · noticeAdapter · eventAdapter ...`

## Part 12 — 금지사항
Lovable 단계 실 Supabase/실 OAuth/실 매칭/Sentry/PostHog 금지. 16ms+ 프레임 = 빌드 실패. 자동 트리거 16ms+ 오차 = 빌드 실패.

---

## 실행 순서 (36단계)
1. 디자인 토큰 + Tailwind v4 `@theme`
2. 어댑터 인터페이스 22개 골격 + mock
3. TanStack 라우트 셸 + 5탭 BottomNav/Sidebar/RightRail
4. PWA manifest + 가드 SW
5. Pulse 홈 (FOMO 풀세트 + NoticeBar + EventHero)
6. MarketsList + 가격 worker
7. Spot 터미널
8. Futures 터미널 + WASM 청산가
9. DepthChart/Heatmap/Liquidations/WhaleAlert
10. Earn 8종
11. Bots
12. 결정론 엔진(0프레임 게이트)
13. Crash (2.000000 검증)
14. Dice (SHA256)
15. Slots
16. Roulette
17. RPS
18. LuckyBox
19. CardFlip
20. Keepy-Uppy (worker 물리)
21. `<StakeBetPanel>` 자동베팅
22. 입금 USDT+KRW+상품권
23. 출금 + KYC 게이트
24. 출석/만보기/잠금화면/럭키쿠키/룰렛
25. 친구초대 다단계 + 카카오톡 공유
26. CashShop + VIP + 캐시백 + 만원송금
27. **공지 리스트 + 상세**
28. **이벤트 리스트 + 상세 + 카운트다운**
29. 마이페이지 + 거래내역 + 자산
30. 알림센터 + Realtime mock
31. 어드민 셸 + Dashboard
32. 어드민 입금/출금/유저/STR/위험
33. 어드민 콘텐츠/피처/수수료/미션/게임
34. **어드민 공지/이벤트 CRUD + 예약발행**
35. 60fps + INP<100ms 전역 게이트
36. PWA Lighthouse ≥90 + 어댑터 export QA + Cursor 인계 문서 자동생성

각 단계 종료 시 `browser--performance_profile` 통과 → 다음. step 단위로 끊어 보고.

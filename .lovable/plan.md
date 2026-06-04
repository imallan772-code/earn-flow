
# PHONARA V2 — VISUAL LAB (FOMO 극강 정책 반영 최종본)

## 정책 변경 (이번 턴 핵심)

이전 "허위 KPI 금지" 규칙 **폐기**. 놀이터/피드/랜딩/Earn/게임/온보딩 전면에 Stake/Rollbit급 **FOMO 극강** 적용.

## 절대 원칙

- **Visual Lab ONLY**: JSX + className + Framer Motion + `src/mocks/*`만
- **금지 (기술/이식)**: Supabase migration / RLS / RPC / Realtime / Edge / 실제 OAuth / 게임 RNG / Service Worker
- `src/integrations/supabase/` **수정 금지** — README만: "mock only — merge forbidden"
- **사용자 노출 금지 (내부 장치명)**: "FOMO 트리거", `emitFomo`, `FEED_FOMO_*` 등 코드명을 화면 카피에 절대 노출 X
- `features/admin` → 다른 feature import 금지
- 이모지: 로고/탭/게임타일 = **lucide only**. 토스트/마퀴/히어로/랜딩 카피 = 한글 감성 이모지 **적극 사용**

## 스택

TanStack Start v1 · React 19 · TS strict · Tailwind v4 (`src/styles.css` SSOT, CSS 변수만, raw hex 금지) · Framer Motion (LazyMotion + domAnimation) · lucide-react · Pretendard + JetBrains Mono · Zod (props)

## FSD 폴더

```
src/
  features/
    auth/  landing/  onboarding/  home/  feed/  earn/  profile/
    games/{crash,rps,slots,lucky-box,roulette,card-flip,lobby}/
    money-deposit/  money-withdrawal/  money-transfer/
    admin/                              # 다른 feature import 금지
  shared/{ui, motion, layout, lib}/
  routes/
  mocks/                                # balance, feed, missions, games, auth, fomo
  integrations/supabase/README.md       # "mock only — merge forbidden"
docs/{CURSOR-MERGE-MAP.md, LOVABLE-EXPORT-CHECKLIST.md, README.md}
```

## FOMO 극강 정책 (놀이터/피드/랜딩/Earn/게임/온보딩 전면)

### 허용·권장 카피/숫자 (mock, UI 모두)

- 접속/참여: `1,000만+`, `1,012만+`, `전 세계 실시간`, `32만 명 동시 접속`, `지금 N명 미션 중`
- 수익/이벤트: `300% 보너스`, `무한`, `오늘만`, `TOP 0.01%`, `VIP 승급 폭주`
- 금액: 큰 KRW/USDT/PHON, 마스킹 병행 OK (`김**`, `₩1,240,000+`)
- 긴급/희소: `마감 임박`, `남은 N석`, `방금 N건`, 카운트다운, 깜빡이는 badge
- 토스트/마퀴/히어로: 한글 감성 + 이모지 적극 사용

### UI 구현 필수

- **접속자 천단위 롤링 CountUp**: `FOMO_BASE_ONLINE ≈ 10,048,293`에서 초당 ±N 미세 증가 mock (Landing/Feed/Home 헤더 영역)
- **2줄 GPU marquee** (Feed/Landing): 10+종 합성 메시지, 좌→우/우→좌 역방향 2 row
- **게임 6종 공통**: live cashout strip(masked 닉네임), fake big win ticker, multiplier milestone glow
- **온보딩**: 단계마다 `FloatingReward` + "지금 N명이 받는 중" 캡션
- **랜딩 히어로 stats**: 동시접속/오늘지급/이벤트 보너스 3개 카드 큰 숫자
- **Earn**: 미션 카드에 "마감 N분", "남은 N석" badge

### mock SSOT — `src/mocks/fomo.ts`

```
MOCK_ONLINE_COUNT       ≈ 10,048,293 base + tick delta
MOCK_MARQUEE_ROWS       10+ 합성 라인 ([{ icon, text, accent }])
MOCK_LANDING_HERO_STATS 동시접속 / 오늘 지급 PHON / 이벤트 보너스
MOCK_EVENT_BONUS_PERCENT 300
MOCK_CASHOUT_FEED       게임 live ticker mock 데이터
```

본편 `viral-display.ts` 톤과 맞춤 (1,012만+, 32만 동시접속, 300% 등). 한글 카피로 작성, 이모지 포함.

## 디자인 (Cosmic Dark Premium)

- **놀이터 톤**: Landing/Auth/Onboarding/Feed/Home/Earn/Lobby/6게임/Profile — glass, holographic, glow, spring, **FOMO 풀파워**
- **거래소 톤**: Deposit/Withdrawal/Transfer/Exchange placeholder — 프리미엄 glass 시각 + 하단 짧은 disclaimer 1줄 (FOMO 배너는 상단에 OK, 폼 자체는 표준어 유지)
- `styles.css` 토큰: `--color-bg-0/bg-1/surface`, `--color-cyan/purple/pink/gold`, `--color-foreground/muted`, `--shadow-glow-{cyan,purple,pink,gold}` (color-mix), `--font-display`, `--font-numeric`, `--radius: 14px`
- `@layer utilities`: `.glass-1`~`.glass-3`, `.bg-holographic`, `.shadow-depth-1`~`.shadow-depth-3`, `.text-holographic`, `.ring-aurora-live`
- 금지: `bg-clip-text`+이모지 혼용, 컴포넌트별 별도 CSS import, raw hex

## shared (필수)

- **motion**: `springSoft`(180/22), `springSnappy`(380/28), `CountUp`(rAF, tabular-nums, 천단위 콤마), `RollingCountUp`(접속자 전용 빠른 tick), `FloatingReward`, `RewardBurst`(≤12 SVG, reduced-motion fallback), `StreakFlame`, `PageTransition`, `FomoMarquee`(GPU transform 2-row)
- **layout**: `MobileShell`(max-w-md, min-h-dvh, safe-area, cosmic gradient bg), `BottomNav`, `GameBetShellChrome`, `AuthPageShell`, `FloatingOrbs`, `LiveCashoutStrip`
- **ui**: Button/Card/Sheet/Toast/Skeleton, `Premium3DCard`, `PremiumPageHeader`, `MoneyChannelCard`, `OnlineCounterChip`, `UrgencyBadge`(마감/남은 N석/깜빡임)
- **lib**: `cn`, formatters (KRW/USDT/PHON), Supabase import 0건

## BottomNav 4탭 (본편 정합)

| 탭 | 경로 | lucide |
|---|---|---|
| Pulse | `/feed` | Zap |
| Earn | `/earn` | Gamepad2 |
| Trade | `/exchange/BTCUSDT` (라우트 `/exchange/$symbol`) | TrendingUp |
| My | `/my` | User |

활성: neon glow + scale 1.12 spring, min 44px. `/trade` 단독 ❌, PR-1식 5탭 ❌.

## 라우트 (Lovable preview)

```
__root.tsx                QueryClient + Toaster + mock auth ctx
index.tsx                 Landing (FOMO 풀파워)
login.tsx, signup.tsx
onboarding.tsx            ssr:false
_app/route.tsx            ssr:false, MobileShell + BottomNav
  _app/feed.tsx
  _app/earn.tsx
  _app/my.tsx
  _app/exchange.$symbol.tsx     placeholder (거래소 톤)
earn/games/index.tsx              6 lobby tiles
earn/games/$slug.tsx              VisualShell + GameBetShellChrome
deposit/{index,crypto,bank,gift}.tsx
withdrawal/{index,phon,crypto}.tsx
transfer.tsx
admin/index.tsx                   desktop sidebar + 4 KPI mock
```

모든 loader 라우트 `errorComponent` + `notFoundComponent` 필수.

**MERGE 노트**: Lovable `_app/*` 구조는 Cursor에 복사하지 않음 — 내용만 플랫 라우트로 이식.

## 화면별 핵심

| 화면 | 톤 | FOMO 요소 |
|---|---|---|
| Landing | 놀이터 | RollingCountUp(1,000만+) 히어로, 2줄 marquee, hero stats 3카드(동시접속/오늘 지급/300% 보너스), dual CTA, 이모지 OK |
| Auth | 놀이터 | 4탭(phone PIN / email / passkey slot / Google mock), OTP neon, "지금 N명 가입 중" 캡션, `mockSignIn()` |
| Onboarding | 놀이터 | 4 step +1000/+500/+200/+100, dot progress, no back/skip, 단계마다 FloatingReward + "지금 N명이 받는 중" |
| Feed | 놀이터 | OnlineCounterChip(롤링), Hot strip, pulse, vertical stream, 2줄 GPU marquee, fake big win ticker, `김**`/큰 금액 마스킹 |
| Home | 놀이터 | CountUp 잔고, 출석 CTA + 마감 카운트다운, 추천 미션 카드 |
| Earn | 놀이터 | StreakFlame, daily/limited 미션(UrgencyBadge: 마감 N분/남은 N석), 미스터리박스, viral stub, "TOP 0.01%" 배너 |
| Lobby | 놀이터 | 6 lucide 타일 + live big win ticker 상단 |
| 6 게임 | 놀이터 | live cashout strip(masked), big win ticker, milestone glow |
| Profile | 놀이터 | 닉네임, 추천코드 copy, VIP 등급 폭주 배너, logout mock |
| Deposit | 거래소+상단 FOMO 배너 | hub(USDT/원화/상품권) + 3 channels, 폼 표준어 + 하단 disclaimer 1줄 |
| Withdrawal | 거래소+상단 FOMO 배너 | hub + phon/crypto forms + 한도/수수료/KYC mock, disclaimer |
| Transfer | bridge | PHON↔USDT mock |
| Exchange | 거래소 | placeholder |
| Admin | desktop | sidebar + 4 KPI mock, no auto-seed |

## 6 게임 Visual Shell (로직 ZERO)

```
GameBetShellChrome (mock balance, currency toggle slot, back)
  └── {Game}VisualShell
        props: phase, onMockBet, onMockCashout, disabled, loading
        // MERGE: {Game}GameAdapter reconnect
```

공통 UX: 44px+, `prefers-reduced-motion`, glass stake panel, win flash ≤12 particles, PF fold(mock hash), history pills, stats strip, **LiveCashoutStrip + big win ticker 공통 마운트**.

1. **crash** — phase: idle/betting/running/crashed/cashed, SVG multiplier curve, countdown, cashout glow, auto-cashout slot, milestone(2x/5x/10x) glow burst
2. **rps** — 3 large neon targets, vs pulse, result burst, win streak counter
3. **slots** — 3~5 reel, spin states, payline win flash, jackpot ticker
4. **lucky-box** — 3D tilt, open glow, reveal, rare drop celebration
5. **roulette** — wheel rotation mock, number grid, active chips, hot/cold 통계 strip
6. **card-flip** — flip grid, match/miss, streak indicator

## 빌드 순서 (고정 15단계)

1. `src/styles.css` (토큰 + utilities + 폰트 link)
2. `shared/ui` + `shared/motion`(+ RollingCountUp, FomoMarquee) + `shared/layout`(+ LiveCashoutStrip, OnlineCounterChip, UrgencyBadge)
3. MobileShell + BottomNav (4탭) + `src/mocks/fomo.ts` + 기타 mocks
4. Landing (FOMO 풀파워 히어로)
5. Auth (phone/email/passkey/google UI + 가입 카운터)
6. Onboarding 4-step (단계별 FloatingReward + "지금 N명")
7. Feed + Home (OnlineCounterChip + 2줄 marquee + big win ticker)
8. Earn + Game lobby (UrgencyBadge + 6 타일 + 로비 상단 ticker)
9. 게임 6 VisualShell (crash → rps → slots → lucky-box → roulette → card-flip, 공통 LiveCashoutStrip)
10. Profile / My (VIP 배너)
11. Deposit hub + 3 channels (상단 FOMO 배너 + 하단 disclaimer)
12. Withdrawal hub + 2 channels (동일)
13. Transfer bridge
14. Admin KPI + Exchange placeholder
15. `docs/CURSOR-MERGE-MAP.md` + `LOVABLE-EXPORT-CHECKLIST.md` + `README.md`

## CURSOR-MERGE-MAP.md (15단계에 완성)

상단 고정:
> Adapter, `useGameWallet`, `useAuth`, Supabase RPC는 Lovable에서 가져오지 않는다. JSX/className/motion만 교체, handler reconnect.
> **FOMO 과장 카피는 Cursor `viral-display.ts`, `feed-fomo-engine.ts`, `feed.tsx`와 강화 병합한다 (축소 금지).**

표 (Lovable → Cursor 본편):

| Lovable | Cursor |
|---|---|
| `features/auth/*` | `components/pages/LoginClient.tsx`, `AuthPageShell.tsx`, `routes/login.tsx`, `signup.tsx` |
| `features/landing/*` | `routes/index.tsx`, `welcome.tsx` |
| `features/onboarding/*` | `routes/onboarding.tsx`, `HoloCoin.tsx` |
| `shared/layout/BottomNav` | `components/AppShell.tsx` (Trade = `/exchange/$symbol` BTCUSDT) |
| `shared/layout/PlatformTopBar` | `components/layout/PlatformTopBar.tsx` |
| `shared/layout/LiveCashoutStrip` + `OnlineCounterChip` + `FomoMarquee` | `viral-display.ts`, `feed-fomo-engine.ts`로 강화 병합 |
| `features/feed/*` | `routes/feed.tsx`, `features/feed/components/*` |
| `features/home/*` | `routes/dashboard.tsx` |
| `features/earn/lobby/*` | `routes/earn.games.tsx`, `game-lobby-registry.ts` (emoji→lucide) |
| `games/crash/CrashVisualShell` | `CrashGameFrozen.tsx`, `CrashVisualStage.tsx` |
| `games/rps/*` | `RpsGameFrozen.tsx` |
| `games/slots/*` | `SlotsGameFrozen.tsx` |
| `games/lucky-box/*` | `LuckyBoxGameFrozen.tsx` |
| `games/roulette/*` | `RouletteGameFrozen.tsx` |
| `games/card-flip/*` | `CardFlipGameFrozen.tsx` |
| `GameBetShellChrome` | `GameBetShell.tsx` (chrome only) |
| `features/money-deposit/*` | `deposit.{index,crypto,bank,gift}.tsx`, `MoneyChannelCard.tsx` |
| `features/money-withdrawal/*` | `withdrawal.{index,phon,crypto}.tsx` |
| `features/money-transfer/*` | `transfer.tsx` |
| `features/profile/*` | `my.tsx`, `settings.tsx` |
| `features/admin/*` | `routes/admin/`, `AdminShell.tsx` |
| `shared/ui/*` | `components/ui/*`, `premium/*` |
| `src/mocks/fomo.ts` | **이식 제외** — 본편 `viral-display.ts` SSOT 사용 |

추가 노트:
- Lovable `_app/*` → Cursor 플랫 라우트
- `src/integrations/supabase/` 절대 export X
- 내부 장치명(`emitFomo`, `FEED_FOMO_*`) 카피 노출 0건 확인

## 기술 가드레일

- TanStack Query `defaultPreloadStaleTime: 0`, suspense pattern (mock)
- mock 호출 try/catch + 한글 토스트
- 모든 marquee/ticker `transform: translate3d`로 GPU, `will-change` 적정 사용
- `prefers-reduced-motion`: marquee 정지, RewardBurst 단순화, RollingCountUp 즉시값
- Lighthouse mobile 목표: Perf ≥85, INP <200ms

## Export 체크

- [ ] Lovable preview URL
- [ ] `src/styles.css` + 모든 `features/*` + `shared/*` + `mocks/*` (fomo 포함)
- [ ] 6 game VisualShell + lobby + LiveCashoutStrip
- [ ] deposit / withdrawal / transfer UI
- [ ] `docs/CURSOR-MERGE-MAP.md` (표 완본 + FOMO 강화 병합 문장)
- [ ] `README.md`: "Visual Lab only · no migrations · merge target: phonara-world-main · FOMO 극강 정책"

---

**승인 시 위 15단계를 순서대로 실행합니다.** Supabase 실연동/migration/RPC/RNG/OAuth는 0건, FOMO 극강 카피·숫자·모션은 mock으로 풀파워.

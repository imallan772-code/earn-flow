# CURSOR MERGE MAP — PHONARA V2 Visual Lab → `phonara-world-main`

> **이식 규칙 (절대 위반 금지)**
>
> Adapter, `useGameWallet`, `useAuth`, Supabase RPC는 Lovable에서 가져오지 않는다.
> JSX / className / framer-motion 모션만 교체하고, 모든 핸들러는 본편의 기존 함수에 reconnect 한다.
>
> **FOMO 과장 카피·숫자는 Cursor `viral-display.ts`, `feed-fomo-engine.ts`, `feed.tsx`와 강화 병합한다 (축소 금지).**

## 1:1 파일 지도

| Lovable (Visual Lab) | Cursor `phonara-world-main` |
|---|---|
| `src/features/auth/AuthShell.tsx` | `src/components/pages/LoginClient.tsx`, `AuthPageShell.tsx`, `src/routes/login.tsx`, `signup.tsx` |
| `src/features/landing/Landing.tsx` | `src/routes/index.tsx`, `welcome.tsx` |
| `src/features/onboarding/Onboarding.tsx` | `src/routes/onboarding.tsx`, `HoloCoin.tsx` |
| `src/shared/layout/MobileShell.tsx` | `src/components/AppShell.tsx` (shell only) |
| `src/shared/layout/BottomNav.tsx` | `src/components/AppShell.tsx` 4탭 — **Trade = `/exchange/$symbol` BTCUSDT** |
| `src/shared/layout/LiveCashoutStrip.tsx` + `OnlineCounterChip.tsx` + `src/shared/motion/FomoMarquee.tsx` | `viral-display.ts`, `feed-fomo-engine.ts`로 **강화 병합** (축소 금지) |
| `src/features/feed/FeedScreen.tsx` | `src/routes/feed.tsx`, `src/features/feed/components/*` |
| `src/features/earn/EarnScreen.tsx` | `src/routes/earn.tsx`, `dashboard.tsx` (Home 영역) |
| `src/features/games/lobby/GameLobby.tsx` | `src/routes/earn.games.tsx`, `game-lobby-registry.ts` (emoji → lucide 교체) |
| `src/features/games/crash/CrashVisualShell.tsx` | `CrashGameFrozen.tsx`, `CrashVisualStage.tsx` |
| `src/features/games/rps/RpsVisualShell.tsx` | `RpsGameFrozen.tsx` |
| `src/features/games/slots/SlotsVisualShell.tsx` | `SlotsGameFrozen.tsx` |
| `src/features/games/lucky-box/LuckyBoxVisualShell.tsx` | `LuckyBoxGameFrozen.tsx` |
| `src/features/games/roulette/RouletteVisualShell.tsx` | `RouletteGameFrozen.tsx` |
| `src/features/games/card-flip/CardFlipVisualShell.tsx` | `CardFlipGameFrozen.tsx` |
| `src/shared/layout/GameBetShellChrome.tsx` | `GameBetShell.tsx` (chrome only — wallet hookup 유지) |
| `src/features/money-deposit/*` | `deposit.index.tsx`, `deposit.crypto.tsx`, `deposit.bank.tsx`, `deposit.gift.tsx`, `MoneyChannelCard.tsx` |
| `src/features/money-withdrawal/*` | `withdrawal.index.tsx`, `withdrawal.phon.tsx`, `withdrawal.crypto.tsx` |
| `src/features/money-transfer/TransferBridge.tsx` | `transfer.tsx` |
| `src/features/exchange/ExchangePlaceholder.tsx` | `exchange.$symbol.tsx` (lightweight-charts 본편 유지) |
| `src/features/profile/ProfileScreen.tsx` | `my.tsx`, `settings.tsx` |
| `src/features/admin/AdminDashboard.tsx` | `src/routes/admin/`, `AdminShell.tsx` |
| `src/shared/ui/*` + `src/shared/motion/*` | `src/components/ui/*`, `src/components/premium/*` |
| `src/styles.css` (토큰 + utilities) | 본편 `src/styles.css` SSOT로 oklch 값 그대로 머지 (raw hex 금지) |

## 이식 제외 (Lovable에서 가져오지 말 것)

- `src/integrations/supabase/*` — 본편 client 유지 (Lovable은 mock only)
- `src/mocks/*` — 모든 데이터 mock. 본편의 `viral-display.ts`, RPC, Adapter가 SSOT
- `src/routes/_app/*` 폴더 구조 — Cursor에는 **플랫 라우트**로 이식 (`feed.tsx`, `earn.tsx`, `my.tsx`, `exchange.$symbol.tsx`)
- 게임 mock phase 머신 (`setInterval` 기반 핸들러) — 본편 `*GameAdapter`로 교체
- mockSignIn, mockCompleteStep, navigator.clipboard 토스트의 mock 메시지 — 본편 `useAuth`, RPC, copy 핸들러로 reconnect

## 사용자 노출 금지 확인

- "FOMO 트리거", `emitFomo`, `FEED_FOMO_*` 같은 내부 장치명 카피 노출 0건
- 이모지는 토스트 · 마퀴 · 히어로 카피에만 허용. 로고 · 탭 · 게임 타일 = `lucide-react` only

## 디자인 토큰

`src/styles.css`의 모든 `@theme` 값 (`--color-*`, `--shadow-*`, `--font-*`, `--radius`)을 그대로 본편으로 복사. `@layer utilities`의 glass-1/2/3, bg-holographic/cosmic, shadow-depth-1/2/3, text-holographic, ring-aurora-live, animate-marquee/-rev, animate-phon-pulse도 동일하게 포함.

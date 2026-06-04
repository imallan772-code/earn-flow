# PHONARA V2 — Visual Lab

**Stake.com / Rollbit (놀이터) + Bybit 모바일 (입출금) 수준의 UI/UX 셸**을 Lovable에서 빌드하고, GitHub export 후 Cursor의 본편 `phonara-world-main`에 이식하기 위한 프로젝트입니다.

## 이 프로젝트는 무엇인가요?

- **Visual Lab ONLY** — JSX · className · Framer Motion · `src/mocks/*`만 사용합니다.
- 백엔드 로직(Supabase migration, RLS, RPC, Realtime, Edge, 실제 OAuth, 게임 RNG)은 **0건**입니다.
- `src/integrations/supabase/`는 자동 통합이지만 **이 프로젝트에서는 사용하지 않습니다** (mock only — merge forbidden).
- 본편 이식 시 모든 핸들러는 Cursor의 기존 `useAuth`, `useGameWallet`, RPC, Adapter에 reconnect 합니다.

## FOMO 극강 정책

놀이터·피드·랜딩·Earn·게임·온보딩 전면에 Stake/Rollbit급 도파민 UI를 적용했습니다:

- 1,012만+ 접속자 RollingCountUp
- 2줄 GPU marquee (10+ 합성 메시지)
- 라이브 캐시아웃 스트립, big win ticker
- 300% 보너스 · 마감 임박 · 남은 N석 urgency badge
- 한글 감성 카피 + 이모지 (토스트/마퀴/히어로 한정)

입금/출금/전송 화면은 **거래소 톤** (차분, disclaimer, 표준어)을 유지하면서 상단에만 이벤트 배너를 노출합니다.

## 폴더 구조 (FSD)

```
src/
  features/    auth, landing, onboarding, feed, earn, profile, exchange,
               games/{crash,rps,slots,lucky-box,roulette,card-flip,lobby},
               money-deposit, money-withdrawal, money-transfer, admin
  shared/      ui, motion, layout, lib
  routes/      __root, index, login, signup, onboarding, _app/*, earn/games/*,
               deposit/*, withdrawal/*, transfer, admin/
  mocks/       fomo, balance, missions, games
  integrations/supabase/README.md  ← mock only · merge forbidden
docs/
  CURSOR-MERGE-MAP.md
  LOVABLE-EXPORT-CHECKLIST.md
  README.md (this file)
```

`features/admin/*`는 다른 feature import 금지 (dependency 격리).

## 핵심 라우트

| 경로 | 화면 | 톤 |
|---|---|---|
| `/` | Landing | 놀이터 |
| `/login`, `/signup` | Auth (phone PIN / email / passkey / google) | 놀이터 |
| `/onboarding` | 4단계 +1800 PHON | 놀이터 |
| `/feed` | Pulse 피드 | 놀이터 |
| `/earn` | 미션 · 스트릭 · 미스터리박스 | 놀이터 |
| `/earn/games` | 6게임 로비 | 놀이터 |
| `/earn/games/$slug` | 6게임 VisualShell | 놀이터 |
| `/exchange/BTCUSDT` | 거래소 placeholder | 거래소 |
| `/my` | 프로필 | 놀이터 |
| `/deposit`, `/deposit/{crypto,bank,gift}` | 입금 | 거래소 |
| `/withdrawal`, `/withdrawal/{phon,crypto}` | 출금 | 거래소 |
| `/transfer` | PHON↔USDT bridge | 거래소 |
| `/admin` | 어드민 KPI | desktop |

## 이식 가이드

`docs/CURSOR-MERGE-MAP.md` 참고. JSX/className/motion만 교체, handler는 본편 기존 함수에 reconnect.

## 다음 단계 (Lovable에서 빌드하지 않음)

PR-2~5는 본편 Cursor에서 진행: Keepy-Uppy physics, lightweight-charts 트레이딩, 실제 PG/PWA, KYC 서버, 카카오/OG 공유, 풀 어드민 운영 큐.

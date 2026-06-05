# PHONARA — earn-flow (본편 SSOT)

**earn-flow**가 PHONARA의 단일 본편 저장소입니다. Lovable → GitHub → Cursor Golden Loop로 이 레포 안에서만 개발·배포합니다.

## 절대 배제 (NEVER)

| 프로젝트               | 이유                                         |
| ---------------------- | -------------------------------------------- |
| **phonara-world-main** | 구 레거시. 이식·참조·Supabase 연결 전부 금지 |
| **phonetok**           | 별도 프로젝트. 참조 금지                     |

유일한 Supabase: **phonara-gb** (`kanftnqenuzverroodev`) — `docs/SUPABASE-PROJECT-LOCK.md`

## 기술 스택 (고정)

`docs/TECH_STACK.md` — TanStack Start v1 · React 19 · TS strict · Tailwind v4 · Framer Motion · Supabase · lightweight-charts · Canvas2D · Web Workers · Vite PWA · pnpm monorepo (`apps/web` + `apps/admin`)

## 워크플로

1. Lovable: UI/게임 엔진 (경계: `docs/lovable/BOUNDARIES.md`)
2. GitHub push → Cursor `git pull`
3. Cursor: 위생 점검 (`docs/CURSOR_SANITATION_CHECKLIST.md`) + Supabase (`docs/SUPABASE_AUTOMATION_RULES.md`)
4. `bun run check` GREEN

상세: `docs/GOLDEN_LOOP.md`, `AGENTS.md`

## FOMO 극강 정책

놀이터·피드·랜딩·Earn·게임·온보딩 전면에 Stake/Rollbit급 도파민 UI:

- 1,012만+ 접속자 RollingCountUp
- 2줄 GPU marquee (10+ 합성 메시지)
- 라이브 캐시아웃 스트립, big win ticker
- 보너스 · 마감 임박 · 남은 N석 urgency badge
- 한글 감성 카피 + 이모지 (토스트/마퀴/히어로 한정)

입금/출금/전송은 **거래소 톤** 유지.

## 폴더 구조

```
src/
  features/     화면
  shared/       games, wallet, motion, livefeed
  routes/       TanStack thin routes
  mocks/        FOMO display only
  lib/api/      RPC wrappers (Cursor only)
  integrations/supabase/  client + types (Cursor only)
supabase/       migrations (Cursor only)
docs/lovable/   Lovable SSOT
```

## 핵심 라우트

| 경로                                   | 화면               |
| -------------------------------------- | ------------------ |
| `/`                                    | Landing            |
| `/login`, `/signup`                    | Auth               |
| `/onboarding`                          | 온보딩             |
| `/feed`                                | Pulse 피드         |
| `/earn`                                | 미션 · 게임 로비   |
| `/games/{crash,dice,plinko,mines}`     | Provably Fair 게임 |
| `/my`                                  | 프로필             |
| `/deposit`, `/withdrawal`, `/transfer` | 입출금             |

## 백로그 (나중에 할 일)

`docs/backlog/` — 지금 당장 하지 않는 작업을 잊지 않기 위한 리스트. 마스터: `docs/backlog/LATER.md`

## 레거시 문서

`docs/CURSOR-MERGE-MAP.md` — **폐기**. phonara-world-main 이식 가이드였으나 더 이상 사용하지 않음.

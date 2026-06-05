# Lovable 프롬프트 고정 헤더 (매 라운드 맨 위에 복붙)

```text
=== PHONARA earn-flow · Lovable 라운드 시작 ===

아래 문서를 모두 준수하라 (순서대로):
1. docs/lovable/PROMPT_HEADER.md (본 헤더)
2. docs/CURSOR_AUDIT_NOTES.md — blocking=Yes 행을 plan에 의무 반영
3. docs/lovable/BOUNDARIES.md
4. docs/LOVABLE_WORK_RULES.md
5. docs/TECH_STACK.md
6. (게임 UX 로드맵 라운드 시) docs/backlog/rounds/GAMES-ROADMAP-v2.1.md — 해당 ROUND 섹션만

【워크플로】
Lovable 생성 → GitHub export → Cursor pull → 최적화·감사·수리

【기술 스택 (고정)】
- TanStack Start v1 + React 19 + TypeScript strict
- Tailwind v4 CSS-first (src/styles.css @theme)
- Framer Motion: LazyMotion + domAnimation only
- Supabase: RLS / RPC security definer / Realtime / Edge (Cursor 전담)
- lightweight-charts + Canvas2D + Web Workers (연산은 Worker 분리)
- Vite PWA 플러그인 (Cursor 전담 — Lovable 금지)
- pnpm monorepo 목표: apps/web + apps/admin

【Golden Loop】
Lovable 작업 → GitHub push → Cursor pull/감사/수리.
DB·migration·RPC·types는 Lovable 금지 → TODO만 남기고 Cursor에 넘김.

【Supabase 프로젝트】
phonara-gb (kanftnqenuzverroodev) ONLY
phonara-world-main · phonetok 절대 금지

【절대 금지】
- supabase/ 수정
- src/integrations/supabase/ 수정 (client.ts, env.ts, types.ts)
- src/lib/api/ 수정
- walletStore 스키마 변경 (xp/vip/rakeback 등 필드 추가)
- wallet.credit() / wallet.tryDebit()을 mock·useEffect·비게임 UI에서 호출
- zustand 도입
- vite.config.ts에 플러그인 수동 추가
- 컴포넌트 안 인라인 mock 배열 (반드시 src/mocks/ 사용)
- PlinkoBoard 패턴 복제 (canvas+wallet+bet 한 파일)
- localStorage key 변경 (phonara.wallet.v1, phonara.gamestate.*)

【필수】
- Engine = 순수함수 + vitest 4~6케이스
- Screen = 오케스트레이션 (~150줄 목표, 180줄 상한)
- StakeBetPanel / BetSummaryPanel / provablyFair.ts 재사용
- GameShell / useGameRound 사용 (셸 라운드)
- 신규 게임은 gameRegistry.ts 등록 (있으면)
- real-money 이관 지점에 TODO: 주석
- 타이머: ReturnType<typeof setTimeout>

【라운드 종료 보고 (필수)】
- 변경 파일 목록
- 비대상 준수 여부 (Y/N)
- bunx eslint . --max-warnings=0 결과
- bunx vitest run 결과 (또는 bun run test)
- bun run build 결과
- 수동 회귀 (해당 게임만)
- supabase/ 변경 0건 확인

【DB 필요 시】
코드에 TODO: 만 남기고 migration/SQL 작성하지 마라.
예: // TODO: real money — debit_phon_for_bet RPC 필요 (Cursor)

=== 라운드 지시 (아래에 작성) ===

```

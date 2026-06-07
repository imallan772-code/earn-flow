# AGENTS.md — earn-flow Cursor Agent SSOT

## Workflow

```text
Lovable 생성 → GitHub export/push → Cursor pull → 최적화·감사·수리 → bun run check GREEN
```

## Tech Stack (고정)

| 항목      | 값                                                                       |
| --------- | ------------------------------------------------------------------------ |
| Framework | TanStack Start **v1** + TanStack Router                                  |
| UI        | React **19**, TypeScript **strict**                                      |
| Style     | Tailwind **v4** — `src/styles.css` `@theme` (CSS-first)                  |
| Motion    | Framer Motion — `LazyMotion` + `domAnimation`                            |
| Backend   | Supabase — RLS, RPC (SECURITY DEFINER), Realtime, Edge Functions         |
| Charts    | `@tradingview/lightweight-charts` + Canvas2D + Web Workers               |
| PWA       | Vite PWA plugin (Cursor only)                                            |
| Monorepo  | **pnpm** target: `apps/web` + `apps/admin` (현재 루트 단일 패키지 + bun) |

Full detail: `docs/TECH_STACK.md`

## Commands

```bash
bun install
bun run dev
bun run check    # test + build
bun run lint
bun run lint:strict
bun run test
bun run build
bun run test:e2e          # ends with artifact cleanup (Cursor 렉 방지)
bun run test:e2e:cleanup  # manual: playwright-report, test-results, blob-report
bun run cleanup:workspace # dist/.vite/Cursor cache — after test/check/build
```

**Agent:** 테스트·빌드 후 자동 청소 필수 → `.cursor/rules/test-cleanup-agent.mdc`  
**Agent:** 작업 완료 보고 전 2차 점검 필수 (오류0·오차0) → `.cursor/rules/post-work-audit.mdc`  
E2E 작성·실행 SSOT → `.cursor/rules/e2e-standards.mdc`  
E2E 후 아티팩트 정리: `.cursor/rules/e2e-cleanup.mdc`. 디버그만 `E2E_KEEP_ARTIFACTS=1`.

## Golden Loop

1. Lovable works → GitHub push
2. Cursor: `git pull` → `docs/CURSOR_SANITATION_CHECKLIST.md`
3. Fix FAILs in Cursor (never send back to Lovable)
4. Supabase: `docs/SUPABASE_AUTOMATION_RULES.md`
5. `bun run check` GREEN

## Lovable prompt entry

Copy `docs/lovable/PROMPT_HEADER.md` to every Lovable round.

## Supabase

- Project: **phonara-gb** (`kanftnqenuzverroodev`)
- Forbidden: **phonara-world-main**, phonetok
- Lovable must NOT touch: `supabase/`, `src/integrations/supabase/types.ts`, `src/lib/api/`

## Structure

```
src/features/     screens
src/shared/       games, wallet, motion, livefeed
src/routes/       TanStack thin routes
src/mocks/        FOMO display only
src/lib/api/      RPC wrappers (Cursor)
supabase/         migrations (Cursor)
docs/lovable/     Lovable SSOT
```

Target monorepo:

```
apps/web/         user app
apps/admin/       admin app
packages/         shared
```

## vite.config.ts

Do NOT add plugins manually — use `@lovable.dev/vite-tanstack-config` only. PWA = Cursor task.

## Rules

`.cursor/rules/*.mdc` — auto-loaded

# AGENTS.md — earn-flow Cursor Agent SSOT

## Commands

```bash
bun install
bun run dev
bun run check    # lint + test + build
bun run lint
bun run test
bun run build
```

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
- Forbidden: phonara-world-main, phonetok
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

## vite.config.ts

Do NOT add plugins manually — use @lovable.dev/vite-tanstack-config only.

## Rules

`.cursor/rules/*.mdc` — auto-loaded

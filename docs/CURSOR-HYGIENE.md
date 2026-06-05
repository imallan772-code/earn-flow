# Cursor · IDE 청소 SSOT

## `.cursorignore` (필수)

- node_modules/, bun.lock
- dist/, .output/, .vinxi/, .tanstack/, .nitro/
- src/routeTree.gen.ts
- .env, .env.\*
- .lovable/

## alwaysApply 규칙

| 파일                      | alwaysApply   |
| ------------------------- | ------------- |
| `00-earn-flow-master.mdc` | true          |
| `golden-loop.mdc`         | true          |
| `quality-gate.mdc`        | true          |
| `money-safety.mdc`        | true          |
| `supabase-auto.mdc`       | true          |
| `lovable-handoff.mdc`     | false (globs) |

## Lovable 연동

규칙 파일은 GitHub에 push → Lovable auto-sync.
Lovable 프롬프트: `docs/lovable/PROMPT_HEADER.md` 복붙.

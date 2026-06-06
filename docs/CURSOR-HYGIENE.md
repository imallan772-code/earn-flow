# Cursor · IDE 청소 SSOT

## `.cursorignore` (필수)

- node_modules/, bun.lock
- dist/, .output/, .vinxi/, .tanstack/, .nitro/, coverage/
- apps/admin/dist/, apps/admin/node_modules/
- src/routeTree.gen.ts
- .env, .env.\*
- .lovable/

## 정기 청소

```bash
bun run cleanup:workspace
```

- 빌드 캐시 (`dist`, `.tanstack`, `supabase/.temp` 등)
- E2E 아티팩트 (`playwright-report`, `test-results`)
- Cursor 프로젝트 캐시 (`agent-tools`, 오래된 `agent-transcripts` 8개만 유지)

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

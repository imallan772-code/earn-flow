# Lovable 작업 SSOT (`docs/lovable/`)

Lovable AI에게 작업 지시할 때 **이 폴더가 진입점**이다.

## 매 라운드 필수

1. **[PROMPT_HEADER.md](./PROMPT_HEADER.md)** — 프롬프트 맨 위에 복붙
2. **[BOUNDARIES.md](./BOUNDARIES.md)** — Lovable 담당/금지 경계
3. **[../LOVABLE_WORK_RULES.md](../LOVABLE_WORK_RULES.md)** — 아키텍처 상세

## 라운드 종료

4. **[ROUND_REPORT_TEMPLATE.md](./ROUND_REPORT_TEMPLATE.md)** — Lovable 보고 형식

## 이후 Cursor

5. `git pull` → [../CURSOR_SANITATION_CHECKLIST.md](../CURSOR_SANITATION_CHECKLIST.md)
6. DB 필요 시 → [../SUPABASE_AUTOMATION_RULES.md](../SUPABASE_AUTOMATION_RULES.md)

## Golden Loop

[Lovable] → GitHub push → [Cursor pull/감사/수리] → `bun run check` → 다음 라운드

상세: [../GOLDEN_LOOP.md](../GOLDEN_LOOP.md)

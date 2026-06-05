# Golden Loop — Lovable ↔ Cursor 영구 운영 SOP

기술 스택: `docs/TECH_STACK.md`

## 한 사이클

```text
[1] Lovable 생성 — PROMPT_HEADER + TECH_STACK 준수
[2] Lovable 게이트 — eslint / vitest / build GREEN
[3] GitHub export / push
[4] Cursor git pull → 최적화·감사
[5] CURSOR_SANITATION_CHECKLIST.md (15분)
[6] FAIL → Cursor 수리 (Lovable에 되돌리지 않음)
[7] Supabase → SUPABASE_AUTOMATION_RULES.md (Cursor)
[8] bun run check GREEN
[9] 다음 Lovable 라운드
```

## 역할 분담

|                      | Lovable | Cursor                   |
| -------------------- | ------- | ------------------------ |
| UI / Engine / Screen | O       | 감사만                   |
| mocks FOMO           | O       | money fallback 금지 검사 |
| supabase/ migration  | **X**   | **O**                    |
| walletStore 스키마   | **X**   | **O**                    |
| 수리                 | **X**   | **O**                    |

## Supabase SSOT

- 프로젝트: **phonara-gb** (`kanftnqenuzverroodev`)
- 배제: phonara-world-main, phonetok

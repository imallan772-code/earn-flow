# Golden Loop — Lovable ↔ Cursor 영구 운영 SOP

## 한 사이클

```text
[1] Lovable 라운드 — docs/lovable/PROMPT_HEADER.md 복붙 후 작업
[2] Lovable 게이트 — eslint / vitest / build GREEN
[3] GitHub push (Lovable auto-sync)
[4] Cursor git pull
[5] Cursor 15분 감사 — docs/CURSOR_SANITATION_CHECKLIST.md
[6] FAIL → Cursor 수리 (Lovable에 되돌리지 않음)
[7] Supabase 필요 → docs/SUPABASE_AUTOMATION_RULES.md (Cursor 자동)
[8] bun run check GREEN
[9] 다음 Lovable 라운드
```

## 역할 분담

| | Lovable | Cursor |
|---|---------|--------|
| UI / Engine / Screen | O | 감사만 |
| mocks FOMO | O | money fallback 금지 검사 |
| supabase/ migration | **X** | **O** |
| walletStore 스키마 | **X** | **O** |
| 수리 | **X** | **O** |

## Supabase SSOT

- 프로젝트: **phonara-gb** (`kanftnqenuzverroodev`)
- 배제: phonara-world-main, phonetok

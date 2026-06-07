# Supabase Project Lock — phonara-gb ONLY

earn-flow의 **유일한** Supabase 프로젝트.

| 항목           | 값                                       |
| -------------- | ---------------------------------------- |
| Dashboard 이름 | phonara-gb                               |
| Reference ID   | kanftnqenuzverroodev                     |
| API URL        | https://kanftnqenuzverroodev.supabase.co |

## 절대 금지

- **phonara-world-main** (wyhhdyrvqtoejvusnhva)
- **phonetok** (ywfldefkfktyyuccqnqt)
- **ai-quest-hub / 타 계정** (tfntynjlkfacoxwrooba) — earn-flow와 무관
- 다른 프로젝트로 CLI relink (명시 지시 없이)

## Cursor MCP (earn-flow 전용)

루트 `.mcp.json`이 `project_ref=kanftnqenuzverroodev`로 **phonara-gb만** 노출한다.
글로벌 `~/.cursor/mcp.json`에 다른 계정 OAuth가 있어도 이 워크스페이스 MCP는 phonara-gb로 스코프됨.
변경 후 Cursor 재시작 또는 Settings → Tools & MCP에서 Supabase 재연결.

## 환경변수

```
VITE_SUPABASE_URL=https://kanftnqenuzverroodev.supabase.co
VITE_SUPABASE_ANON_KEY=<dashboard에서 복사>
```

## Cursor 작업 범위

- `supabase/migrations/`
- `src/integrations/supabase/types.ts` (MCP 재생성)
- `src/lib/api/` (RPC 래퍼)

# Supabase 자동화 규칙 (Cursor 전용)

## 프로젝트 Lock

| 항목 | 값 |
|------|-----|
| 이름 | phonara-gb |
| Reference ID | kanftnqenuzverroodev |
| URL | https://kanftnqenuzverroodev.supabase.co |

**배제:** phonara-world-main, phonetok — 절대 참조 금지

## 트리거 (자동 시작)

- `.rpc(`, `.from(` 신규 in features
- real money / onboarding / 출금 기능
- Lovable TODO에 RPC/Edge 언급
- migration ↔ types.ts 불일치

## 작업 순서

```text
1. list_tables + list_migrations
2. get_advisors
3. supabase/migrations/YYYYMMDDHHMMSS_<name>.sql 작성
4. SQL: 테이블 → RLS → policies → RPC(security definer) → trigger
5. apply_migration (Supabase MCP)
6. generate_typescript_types → src/integrations/supabase/types.ts
7. src/lib/api/*.ts RPC 래퍼
8. features는 래퍼만 import
9. get_advisors 재실행
10. bun run check GREEN
```

## SQL 필수

- RLS on all public tables
- UPDATE needs SELECT policy
- Money: RPC only, no client UPDATE on balances
- RPC: SECURITY DEFINER + SET search_path = public + auth.uid() check
- Signup trigger: profiles + wallet_balances

## Lovable 금지

- supabase/
- src/integrations/supabase/types.ts
- src/lib/api/

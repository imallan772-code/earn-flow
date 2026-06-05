# Admin Platform — 완료 보고 (2026-06-06)

## 구현 요약

| 영역           | 내용                                                          |
| -------------- | ------------------------------------------------------------- |
| **DB**         | `notices`, `admin_users`, admin RPC 9종, seed notices         |
| **보안**       | `assert_is_admin()` + anon revoke on admin RPCs               |
| **API**        | `src/lib/api/admin/*`, `src/lib/api/notices.ts`               |
| **가드**       | `RequireAdmin` + `VITE_ADMIN_ENABLED` / `VITE_ADMIN_DEV_OPEN` |
| **UI**         | `AdminLayout` + Dashboard/Notice/Event → Supabase CRUD        |
| **사용자 앱**  | `useNotices` → `/notice` Supabase SSOT                        |
| **Standalone** | `apps/admin` → `src/admin/App.tsx` (admin.phonara.com 준비)   |

## Bootstrap (최초 1회)

Supabase SQL Editor:

```sql
INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users WHERE email = 'your@email.com';
```

## 환경 변수

| 변수                       | 용도                                          |
| -------------------------- | --------------------------------------------- |
| `VITE_ADMIN_ENABLED=true`  | web 앱 `/admin` 노출 (프로덕션 의도적 활성화) |
| `VITE_ADMIN_DEV_OPEN=true` | 로컬 dev only — admin_users 없이 /admin 허용  |

## 배포

```bash
pnpm --filter @phonara/admin build   # → apps/admin/dist
bun run admin:build
```

## 후속 (선택)

- 출금 승인 큐 RPC + Admin UI
- `packages/shared` 추출 (도메인 분리 2단계)
- Admin audit log 테이블

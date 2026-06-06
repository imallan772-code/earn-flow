# Google OAuth — PHONARA 로그인

**Goal:** 로그인/가입 화면 **구글** 탭 → Google 계정으로 1클릭 로그인.

클라이언트: `signInWithGoogle` → Google → **`/auth/callback`** → `/feed`  
아래는 **Google Cloud + Supabase** 설정만 하면 됩니다.

---

## 1. Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 생성 (예: `phonara-gb`)
2. **APIs & Services → OAuth consent screen**
   - User type: **External** (테스트 중이면 Test users에 본인 Gmail 추가)
   - App name: `PHONARA`, support email 입력 → Save
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `PHONARA Supabase`
   - **Authorized redirect URIs** (필수, 정확히 일치):

```
https://kanftnqenuzverroodev.supabase.co/auth/v1/callback
```

4. **Client ID** / **Client secret** 복사

---

## 2. `.env` (gitignore — 커밋 금지)

```env
SUPABASE_ACCESS_TOKEN=sbp_xxx

GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

---

## 3. Push (한 줄)

```bash
bun run supabase:auth:google
```

성공 시 Dashboard → **Authentication → Providers → Google** ON 확인.

---

## 4. 로컬 테스트

1. `bun run dev` → http://localhost:8080/login
2. **구글** 탭 → **구글 계정으로 계속**
3. Google 로그인 → `/auth/callback` (연결 중) → `/feed` (또는 `/onboarding`)

---

## 5. 출시 시 추가

| 항목 | 값 |
|------|-----|
| Supabase `site_url` | 프로덕션 HTTPS URL |
| `uri_allow_list` | `https://yourdomain.com/**` |
| Google redirect URI | 동일 callback URL 유지 (Supabase ref 불변) |
| OAuth consent | **Publish** (Production) |

`supabase/config.toml` + `bun run supabase:config:push` 로 URL 목록 갱신.

---

## 트러블슈팅

| 증상 | 해결 |
|------|------|
| `Missing Google OAuth credentials` | `.env`에 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| `redirect_uri_mismatch` | Google Console redirect URI가 callback URL과 **완전 일치**하는지 확인 |
| `Provider is not enabled` | `bun run supabase:auth:google` 재실행 |
| `access_denied` (테스트) | OAuth consent → Test users에 Gmail 추가 |
| 로그인 후 404 | `http://localhost:8080/**` 가 Supabase redirect allow list에 있는지 확인 |

---

## SSOT (repo)

| 파일 | 역할 |
|------|------|
| `scripts/auth-config/google-oauth.ts` | Management API patch |
| `scripts/push-supabase-auth-google.ts` | `bun run supabase:auth:google` |
| `supabase/config.toml` | `[auth.external.google]` (CLI push용) |
| `src/features/auth/AuthContext.tsx` | `signInWithOAuth({ provider: "google" })` |

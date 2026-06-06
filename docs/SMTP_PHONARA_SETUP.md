# PHONARA Custom SMTP — Free Supabase + Branded Emails

**Goal:** Supabase Free 유지 + Resend SMTP → PHONARA 제목/본문 편집 가능.

---

## 1. Resend 가입 (Free: 100통/일)

1. [resend.com](https://resend.com) 가입
2. **API Keys** → Create → `re_...` 복사
3. **Domains** → 도메인 추가 후 DNS 인증 (출시용)
   - **개발 테스트:** Resend 기본 `onboarding@resend.dev`는 **본인 Resend 가입 이메일로만** 발송 가능

---

## 2. `.env`에 추가 (gitignore — 커밋 금지)

```env
SUPABASE_ACCESS_TOKEN=sbp_xxx

# Resend SMTP (Free Supabase OK)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxx
SMTP_ADMIN_EMAIL=onboarding@resend.dev
SMTP_SENDER_NAME=PHONARA
```

출시 시 `SMTP_ADMIN_EMAIL=noreply@yourdomain.com` (인증된 도메인).

---

## 3. Push (한 줄)

```bash
bun run supabase:auth:smtp
```

또는 Part 5 + SMTP 함께:

```bash
bun run supabase:auth:part5
```

(`SMTP_*` 있으면 branding 자동 포함)

---

## 4. 확인

1. Dashboard → **Authentication → Emails** → Preview (PHONARA 보라 테마)
2. 앱에서 **회원가입** 또는 **비밀번호 재설정** → 수신함 확인
3. Security 알림은 Part 5에서 이미 ON

---

## 5. 템플릿 SSOT (repo)

| 파일 | 내용 |
|------|------|
| `scripts/auth-config/phonara-email-layout.ts` | 공통 HTML shell |
| `scripts/auth-config/phonara-email-branding.ts` | 13개 제목 + 본문 |
| `scripts/push-supabase-auth-smtp.ts` | Management API push |

수정 후 `bun run supabase:auth:smtp` 재실행.

---

## 트러블슈팅

| 증상 | 해결 |
|------|------|
| `Missing SMTP env` | `.env` 5개 키 확인 |
| Resend 403 / domain | `SMTP_ADMIN_EMAIL`이 Resend에 검증된 주소인지 확인 |
| 400 template | SMTP push **먼저**, branding **두 번째** (스크립트가 순서 처리) |
| HIBP still OFF | Pro 플랜 필요 (SMTP와 무관) |

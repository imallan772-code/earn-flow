# Promo 홍보 전 — 수동 설정 체크리스트

> **지금 당장 할 필요 없음.** 실제 홍보·자동 발송 전에 이 파일만 순서대로 따라 하면 됩니다.  
> 코드·마이그레이션은 Cursor 라운드에서 이미 반영됨 — 여기는 **키·Dashboard·OAuth 앱**만.

---

## 0. 빠른 링크

| 문서 | 내용 |
|------|------|
| [PROMO_CRON_SETUP.md](./PROMO_CRON_SETUP.md) | pg_cron · HMAC · PowerShell 테스트 |
| [.env.example](../.env.example) | env 변수 이름 SSOT |
| [WHOSE-TURN.md](./WHOSE-TURN.md) | Lovable / Cursor 차례 |

---

## 1. Supabase (phonara-gb) — 이미 적용된 migration 확인

로컬 `supabase/migrations/` 와 원격이 맞는지 Dashboard → Database → Migrations에서 확인.

| Migration | 용도 |
|-----------|------|
| `20260607010000_promo_engine.sql` | promo 테이블 · admin RPC |
| `20260607180000_promo_cron_service_role.sql` | cron service_role RPC |
| `20260607210000_promo_analytics_clicks_rpc.sql` | clicks list · analytics date-range |

원격에 없으면: `supabase db push` 또는 Dashboard SQL로 해당 파일 실행.

---

## 2. 서버 시크릿 (`.env` 로컬 · Cloudflare/배포 secrets 운영)

```env
# 필수 (cron 자동 발송)
SUPABASE_SERVICE_ROLE_KEY=...
PROMO_CRON_SECRET=...          # 긴 랜덤 문자열

# OAuth state cookie HMAC (없으면 PROMO_CRON_SECRET 재사용)
PROMO_OAUTH_STATE_SECRET=...

# OAuth 앱 (홍보 채널 연결 시)
X_CLIENT_ID=...
X_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...

# AI 카피 (이미 쓰 중이면 생략)
OPENROUTER_API_KEY=...         # 또는 GEMINI_API_KEY
```

로컬 사이트 URL (OAuth redirect 기준):

```env
VITE_SITE_URL=http://localhost:8080
```

---

## 3. OAuth 앱 — Redirect URI 등록

각 개발자 콘솔에 **아래 3개** 등록 (`YOUR_APP` = 배포 도메인 또는 `http://localhost:8080`).

```text
{YOUR_APP}/api/admin/promo/oauth/x/callback
{YOUR_APP}/api/admin/promo/oauth/linkedin/callback
{YOUR_APP}/api/admin/promo/oauth/tiktok/callback
```

| 채널 | 콘솔 | 스코프 참고 |
|------|------|-------------|
| X | [developer.twitter.com](https://developer.twitter.com/) | tweet.read, tweet.write, users.read, offline.access |
| LinkedIn | [linkedin.com/developers](https://www.linkedin.com/developers/) | openid, profile, w_member_social, email |
| TikTok | [developers.tiktok.com](https://developers.tiktok.com/) | user.info.basic, video.publish (앱 심사 필요할 수 있음) |

**연결 테스트 (홍보 전):**

1. `/admin/promo/channels` → admin 로그인
2. X / LinkedIn / TikTok 카드 → **연결** → 로그인 → channels로 돌아오면 toast
3. **연결 확인** 클릭 → 성공 toast

> TikTok은 **텍스트 자동 발행 미지원** (verify만). 캡션은 **copy** 채널 또는 수동.

---

## 4. pg_cron — 예약 캠페인 자동 발송

상세: [PROMO_CRON_SETUP.md](./PROMO_CRON_SETUP.md)

- [ ] Supabase Dashboard → Extensions → **pg_cron** 활성화
- [ ] `PROMO_CRON_SECRET` 배포 환경에 등록
- [ ] 5~15분마다 POST:

```http
POST https://YOUR_APP/api/public/cron/promo-tick
Content-Type: application/json
x-promo-signature: HMAC-SHA256(PROMO_CRON_SECRET, "{}") hex

{}
```

**로컬 1회 테스트 (PowerShell):**

```powershell
$secret = "your-PROMO_CRON_SECRET"
$body = "{}"
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding.UTF8.GetBytes($secret))
$sig = -join ($hmac.ComputeHash([Text.Encoding.UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") })
curl.exe -X POST "http://localhost:8080/api/public/cron/promo-tick" -H "Content-Type: application/json" -H "x-promo-signature: $sig" -d $body
```

---

## 5. Telegram / Webhook (선택)

`/admin/promo/settings` 또는 promo_settings `default_utm` JSON:

- `telegramBotToken` · `telegramChatId`
- `webhookUrl` (Discord / Slack / Zapier)

Telegram은 OAuth 없이 토큰만으로 **연결 확인** · **발행** 가능.

---

## 6. 홍보 직전 스모크 테스트

- [ ] Studio에서 캠페인 1건 생성 → **scheduled** 예약
- [ ] 채널 탭 **연결 확인** (telegram + 연결한 OAuth 채널)
- [ ] cron tick 1회 → dispatch `sent` · Analytics KPI 반영
- [ ] `/api/public/r/{slug}` 클릭 → `promo_clicks` row (Analytics 클릭 수)

---

## 7. 지금은 안 해도 됨

- OAuth 앱 심사·프로덕션 redirect (로컬/스테이징만 쓸 때)
- pg_cron (수동 「지금 발행」만 쓸 때)
- TikTok video Content API

---

*마지막 갱신: 2026-06-07 · Z-OAuth + Z-4 완료 후*

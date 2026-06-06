# Supabase phonara-gb — Promo cron (수동 등록)

`SUPABASE_SERVICE_ROLE_KEY` + `PROMO_CRON_SECRET` 설정 후 Dashboard → Database → Extensions → **pg_cron** 활성화.

## HTTP cron (권장)

Edge/pg_cron에서 주기적으로 POST:

```http
POST https://YOUR_APP/api/public/cron/promo-tick
Content-Type: application/json
x-promo-signature: HMAC-SHA256(PROMO_CRON_SECRET, body) hex

{}
```

로컬 테스트 (PowerShell):

```powershell
$secret = "your-PROMO_CRON_SECRET"
$body = "{}"
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
$sig = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") })
curl.exe -X POST "http://localhost:8080/api/public/cron/promo-tick" -H "Content-Type: application/json" -H "x-promo-signature: $sig" -d $body
```

## DB RPC (service_role only)

| RPC | 용도 |
|-----|------|
| `cron_list_due_promo_campaigns(p_now?)` | scheduled + due 캠페인 |
| `cron_get_promo_settings()` | telegram/webhook 설정 |
| `cron_record_promo_dispatch(p_payload)` | 발송 audit |
| `cron_mark_promo_campaign_status(p_id, p_status)` | 상태 전환 |

Migration: `supabase/migrations/20260607180000_promo_cron_service_role.sql`

## admin_users

운영자 UUID는 `admin_users`에만 등록 (현재: imallan772@gmail.com, dreamtech123123@gmail.com).

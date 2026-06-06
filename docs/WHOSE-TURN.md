# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-07)

| | |
|---|---|
| **지금** | 🤖 **Lovable AI** — **Phase Z-3** (Calendar/Analytics polish) |
| **당신** | `.env`에 `SUPABASE_SERVICE_ROLE_KEY` + `PROMO_CRON_SECRET` → promo cron/이미지 Storage QA |
| **Cursor** | **Z-2 Supabase** ✅ cron RPC · Storage upload · admin_users x2 · sanitation |

### ROUND Z-2 Supabase (Cursor)

- Migration `20260607180000_promo_cron_service_role.sql` applied (phonara-gb)
- service_role cron RPCs + `/api/public/cron/promo-tick` 실 dispatch
- `promo-assets` Storage upload (image-stream → public URL)
- `admin_users`: imallan772 + dreamtech123123
- `lib/api/promo/mappers` · `persisting` gate (RPC 400 spam fix)

### ROUND Z-2 완료 (Lovable v1.3 + Cursor sanitation)

- Image SSE (`image-stream` + `image.server.ts`) · Imagen endpoint · admin gate
- webhook/telegram real adapters · SSRF `assertSafeUrl`
- `publishPromoCampaign` vs `runPromoCronTick` UI 분리
- cron HMAC 골격 (`CRON_DB_READ_CURSOR_TODO`)
- promo tests **68+** GREEN
- Cursor: `lib/api/promo/mappers` — `image_url`↔`imageUrl` read-back · telegram `toSettings`

### ROUND Z-SWAP 완료 (Cursor)

- `usePromoAdmin` — Supabase configured 시 `lib/api/promo` RPC, else mockStore

### ROUND Z-1 완료 (Lovable + Cursor sanitation)

- Gemini Flash + fallback · 단일 AI call

### ROUND Z-DB 완료 (Cursor)

- `supabase/migrations/20260607010000_promo_engine.sql` · `lib/api/promo.ts`

---

## ROUND Z 큐

```text
[완료] Z-0 · Z-DB · Z-1 · Z-SWAP · Z-2 (Lovable + Cursor sanitation)
[지금] Lovable → Z-3 (Calendar/Analytics polish)
[병렬] Cursor → cron service-role RPC · promo-assets Storage · Z-OAuth
[수동] pg_cron + PROMO_CRON_SECRET + GEMINI_API_KEY
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-07 | **Z-2 완료** → Lovable Z-3 / Cursor cron·Storage·OAuth |
| 2026-06-07 | **Z-SWAP 완료** → Lovable Z-2 |
| 2026-06-07 | **Z-1 완료** → Z-SWAP / Z-2 |
| 2026-06-07 | **Z-0 + Z-DB 완료** → Lovable Z-1 |

# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-07)

| | |
|---|---|
| **지금** | 🤖 **Lovable AI** — **Phase Z-1** (Studio compose + Live Preview 5종 + risk scan UI) |
| **당신** | Z-0 merge 확인 · `/admin/promo` 수동 QA |
| **Cursor** | **Z-0 sanitation** ✅ · **Z-DB** ✅ (promo_* migration + `lib/api/promo.ts` + types regen) |

### ROUND Z-0 완료 (Lovable + Cursor sanitation)

- `/admin/promo` 7-tab shell + client mockStore + 28 tests GREEN
- Cursor: cron route fix · `record_promo_click` wired on `/api/public/r/$slug`

### ROUND Z-DB 완료 (Cursor)

- `supabase/migrations/20260607010000_promo_engine.sql`
- 6 tables + admin RPCs + `record_promo_click` + `promo-assets` bucket
- `src/lib/api/promo.ts` + `src/integrations/supabase/types.ts` regen
- pg_cron: manual — enable `pg_cron` + `pg_net`, schedule POST to `/api/public/cron/promo-tick`

---

## ROUND Z 큐

```text
[완료] Z-0 (Lovable UI shell) · Z-DB (Cursor Supabase)
[지금] Lovable → Z-1 (AI compose + Preview)
[다음] Lovable → Z-2 (Image SSE + real channels)
[그다음] Lovable → Z-3 (Calendar/Analytics polish)
[병렬 가능] Cursor → Z-OAuth (X/LinkedIn/TikTok)
[수동] pg_cron schedule + PROMO_CRON_SECRET in deploy secrets
```

---

## 기타 큐 (보류)

```text
[보류] Lovable Q-c polish · R Cashier shell
[수동] Supabase Part 5 — leaked password protection
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-07 | **Z-0 + Z-DB 완료** → Lovable Z-1 |
| 2026-06-06 | **Q-PR1 + Hardening** → Lovable Q-c / R |
| 2026-06-06 | **P-PR2 완료** → Cursor P-PR1 |

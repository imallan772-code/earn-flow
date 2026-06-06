# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-07)

| | |
|---|---|
| **지금** | 🤖 **Cursor** — **Z-OAuth** (X / LinkedIn / TikTok) |
| **당신** | migration `20260607210000` phonara-gb apply · pg_cron 등록 (`docs/PROMO_CRON_SETUP.md`) |
| **Cursor** | **Z-4** ✅ clicks RPC + analytics date-range · **Z-3** ✅ |

### ROUND Z-4 Analytics RPC (Cursor)

- Migration `20260607210000_promo_analytics_clicks_rpc.sql`
- `admin_list_promo_clicks` · `admin_promo_analytics_summary(p_from, p_to)`
- `usePromoAdmin.clicks[]` · AnalyticsDashboard 기간별 클릭/CTR

### ROUND Z-3 완료 (Lovable v1.3.1 + Cursor sanitation)

- `calendarGrid.ts` · `analyticsAggregate.ts` + vitest 13 cases
- CalendarBoard 월간 그리드 + listView · AnalyticsDashboard
- Cursor: mock flash 제거 · PromoShell persisting subtitle

### ROUND Z-2 Supabase (Cursor)

- Migration `20260607180000_promo_cron_service_role.sql` applied (phonara-gb)
- service_role cron RPCs + `/api/public/cron/promo-tick` 실 dispatch
- `promo-assets` Storage upload (image-stream → public URL)

---

## ROUND Z 큐

```text
[완료] Z-0 · Z-DB · Z-1 · Z-SWAP · Z-2 · Z-3 · Z-4
[지금] Cursor → Z-OAuth
[수동] pg_cron + PROMO_CRON_SECRET · Z-4 migration apply
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-07 | **Z-4 완료** → Cursor Z-OAuth |
| 2026-06-07 | **Z-3 완료** → Cursor Z-4 RPC |
| 2026-06-07 | **Z-2 완료** → Lovable Z-3 |
| 2026-06-07 | **Z-SWAP 완료** → Lovable Z-2 |

# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-07)

| | |
|---|---|
| **지금** | 🤖 **Cursor** — **Z-OAuth** (X / LinkedIn / TikTok) · pg_cron 수동 등록 |
| **당신** | promo cron/Storage QA · Lovable Z-3 push 있으면 `git pull` |
| **Cursor** | **Z-3** ✅ Calendar/Analytics polish + sanitation (mock flash · PromoShell · loading) |

### ROUND Z-3 완료 (Lovable v1.3.1 + Cursor sanitation)

- `calendarGrid.ts` · `analyticsAggregate.ts` + vitest 13 cases
- CalendarBoard 월간 그리드 + listView · AnalyticsDashboard
- labels.ko hintConfigured 정리 · `promoDispatchLabel` on timeline
- Cursor: `usePromoAdmin` loading+analyticsQuery · mock flash 제거 · PromoShell persisting subtitle

### ROUND Z-2 Supabase (Cursor)

- Migration `20260607180000_promo_cron_service_role.sql` applied (phonara-gb)
- service_role cron RPCs + `/api/public/cron/promo-tick` 실 dispatch
- `promo-assets` Storage upload (image-stream → public URL)

---

## ROUND Z 큐

```text
[완료] Z-0 · Z-DB · Z-1 · Z-SWAP · Z-2 · Z-3
[지금] Cursor → Z-OAuth
[수동] pg_cron + PROMO_CRON_SECRET
[TODO] list_promo_clicks RPC · promo analytics date-range RPC
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-07 | **Z-3 완료** → Cursor Z-OAuth |
| 2026-06-07 | **Z-2 완료** → Lovable Z-3 |
| 2026-06-07 | **Z-SWAP 완료** → Lovable Z-2 |

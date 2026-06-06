# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-07)

| | |
|---|---|
| **지금** | 👤 **당신** — 홍보 전 수동 설정 → [`docs/PROMO_LAUNCH_CHECKLIST.md`](./PROMO_LAUNCH_CHECKLIST.md) |
| **Cursor** | **Z-5 sanitation** ✅ `usePromoAdmin` analytics `queryFn` sig fix (Z-4 잔여) |
| **Lovable** | **Z-5** ✅ Channels OAuth UI + dual sparkline (`7ea08dc`) |

### ROUND Z-5 (Lovable v1.1 + Cursor sanitation)

- ChannelMatrix: OAuth 3-state (미연동/연동됨/connecting) · reason toast · accent CTA
- AnalyticsDashboard: `dailyClickBuckets` + `ClickDispatchSparkline` (발송·클릭 dual line)
- `analyticsAggregate.ts` pure fn + vitest 10 cases (promo suite 95/95)
- Cursor: `promoAnalyticsSummary` → `queryFn: () => promoAnalyticsSummary()` (TanStack Query sig)

### ROUND Z-OAuth (Cursor)

- `channels/x.ts` · `linkedin.ts` · `tiktok.ts` (verify + send)
- `/api/admin/promo/oauth/$channel/start|callback` · `promo_settings.default_utm` token SSOT
- ChannelMatrix 「연결」버튼 · `resolveChannelSettings` server merge

### ROUND Z-4 Analytics RPC (Cursor)

- Migration `20260607210000_promo_analytics_clicks_rpc.sql`
- `admin_list_promo_clicks` · `admin_promo_analytics_summary(p_from, p_to)`
- `usePromoAdmin.clicks[]` · AnalyticsDashboard 기간별 클릭/CTR

---

## ROUND Z 큐

```text
[완료] Z-0 · Z-DB · Z-1 · Z-SWAP · Z-2 · Z-3 · Z-4 · Z-OAuth · Z-5
[지금] 수동 → `docs/PROMO_LAUNCH_CHECKLIST.md` (OAuth keys · pg_cron · smoke)
[대기] Z-6+ — 백엔드 필요 시 Cursor가 새 라운드 정의
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-07 | **Z-5 완료** → 수동 PROMO_LAUNCH_CHECKLIST |
| 2026-06-07 | **Z-OAuth 완료** → Lovable Z-5 |
| 2026-06-07 | **Z-4 완료** → Cursor Z-OAuth |
| 2026-06-07 | **Z-3 완료** → Cursor Z-4 RPC |
| 2026-06-07 | **Z-2 완료** → Lovable Z-3 |

# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-07)

| | |
|---|---|
| **지금** | 🤖 **Lovable** — **Z-5** Channels OAuth UI polish (연결 상태 · callback toast · sparkline) |
| **당신** | 홍보 전 수동 설정 → [`docs/PROMO_LAUNCH_CHECKLIST.md`](./PROMO_LAUNCH_CHECKLIST.md) |
| **Cursor** | **Z-OAuth** ✅ X/LinkedIn/TikTok adapters + routes · **Z-4** ✅ |

### ROUND Z-OAuth (Cursor)

- `channels/x.ts` · `linkedin.ts` · `tiktok.ts` (verify + send)
- `/api/admin/promo/oauth/$channel/start|callback` · `promo_settings.default_utm` token SSOT
- ChannelMatrix 「연결」버튼 · `resolveChannelSettings` server merge

### ROUND Z-4 Analytics RPC (Cursor)

- Migration `20260607210000_promo_analytics_clicks_rpc.sql`
- `admin_list_promo_clicks` · `admin_promo_analytics_summary(p_from, p_to)`
- `usePromoAdmin.clicks[]` · AnalyticsDashboard 기간별 클릭/CTR

### ROUND Z-3 완료 (Lovable v1.3.1 + Cursor sanitation)

- CalendarBoard · AnalyticsDashboard UI
- Cursor: mock flash 제거 · PromoShell persisting subtitle

---

## ROUND Z 큐

```text
[완료] Z-0 · Z-DB · Z-1 · Z-SWAP · Z-2 · Z-3 · Z-4 · Z-OAuth
[지금] Lovable → Z-5 UI polish (GATE-2: supabase/lib/api/channels/server diff 0)
[수동] 홍보 전 → `docs/PROMO_LAUNCH_CHECKLIST.md`
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-07 | **Z-OAuth 완료** → Lovable Z-5 |
| 2026-06-07 | **Z-4 완료** → Cursor Z-OAuth |
| 2026-06-07 | **Z-3 완료** → Cursor Z-4 RPC |
| 2026-06-07 | **Z-2 완료** → Lovable Z-3 |

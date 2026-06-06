# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-07)

| | |
|---|---|
| **지금** | 🤖 **Lovable AI** — **Phase Z-2** (Image SSE + real channel adapters) |
| **당신** | Z-SWAP QA · Supabase 로그인 + admin_users로 `/admin/promo` 저장 테스트 |
| **Cursor** | **Z-SWAP** ✅ (mockStore↔RPC `usePromoAdmin`) · **Z-1 sanitation** ✅ |

### ROUND Z-SWAP 완료 (Cursor)

- `usePromoAdmin` — Supabase configured 시 `lib/api/promo` RPC, else mockStore
- Studio·캠페인·캘린더·채널·분석·설정·에셋 탭 wired
- `campaignToUpsertPayload` · `promoUpsertAsset` · imagePrompt via variant utm

### ROUND Z-1 완료 (Lovable + Cursor sanitation)

- Gemini Flash + fallback · 단일 AI call · promo tests 49 GREEN

### ROUND Z-DB 완료 (Cursor)

- `supabase/migrations/20260607010000_promo_engine.sql` · `lib/api/promo.ts`

---

## ROUND Z 큐

```text
[완료] Z-0 · Z-DB · Z-1 · Z-SWAP (Cursor mockStore↔RPC)
[지금] Lovable → Z-2 (Image SSE + real channels)
[그다음] Lovable → Z-3 (Calendar/Analytics polish)
[병렬] Cursor → Z-OAuth (X/LinkedIn/TikTok)
[수동] pg_cron + PROMO_CRON_SECRET + GEMINI_API_KEY
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-07 | **Z-SWAP 완료** → Lovable Z-2 |
| 2026-06-07 | **Z-1 완료** → Z-SWAP / Z-2 |
| 2026-06-07 | **Z-0 + Z-DB 완료** → Lovable Z-1 |

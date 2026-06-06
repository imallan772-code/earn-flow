# ROUND Z-5 v1.1 완료 보고

## 변경 파일 (5)
- `src/shared/admin/labels.ko.ts` — trendTitle/legendDispatch/legendClick, clicksScopeNote 문구 갱신, publish.oauthConnecting/oauthDisconnected/oauthErrorReasons 추가
- `src/lib/promo/analyticsAggregate.ts` — `dailyClickBuckets` pure fn 추가
- `src/lib/promo/__tests__/analyticsAggregate.spec.ts` — 신규 2 케이스 (총 8 → 10)
- `src/features/admin/promo/components/AnalyticsDashboard.tsx` — DispatchSparkline → ClickDispatchSparkline (dual polyline accent/emerald, 공통 max scale, 동일 7/30일 window·ymd)
- `src/features/admin/promo/components/ChannelMatrix.tsx` — OAuth 3-state 배지 (연동됨 emerald / 미연동 neutral / 연결 중 disabled+oauthConnecting), `oauthErrorMessage` helper (서버 SSOT reason 매핑 + length<=40 fallback), 카드 min-h-[128px] + flex-wrap

## GATE-2 비대상 준수 (Y)
- supabase/ · integrations/supabase/ · lib/api/ · channels/ · routes/api/ · *.server.ts · usePromoAdmin diff 0 ✅

## 게이트
- eslint (Z-5 touched files): **0 warnings / 0 errors**
- vitest (전체 promo suite): **95/95 GREEN** (analyticsAggregate 8→10)
- bun run build: ⚠ pre-existing TS errors in `src/features/admin/promo/hooks/usePromoAdmin.ts` (Cursor Z-4 `promoAnalyticsSummary` 시그니처 mismatch — GATE-2 forbidden, **본 라운드 무관**)

## AC 체크
- [x] CH-1 OAuth 3-state (disconnected 「미연동」 neutral / connecting disabled+oauthConnecting / connected emerald pill)
- [x] CH-1 oauthErrorReasons: invalid_channel · missing_code · state_mismatch · app_not_configured · access_denied (+ 미매핑 → fallback)
- [x] CH-2 카드 min-h-[128px] + 모바일 flex-wrap, "…" 하드코딩 제거
- [x] ANA-1 `dailyClickBuckets` + ClickDispatchSparkline dual line (accent/emerald, 공통 max, 동일 길이 ymd)
- [x] ANA-1 period=all → sparkline 7일 window 유지 (회귀 없음)
- [x] ANA-2 `trendTitle` 적용, `clicksScopeNote` 라벨만 갱신 (KPI 로직/레이아웃 0)
- [x] COPY-1 신규 labels.ko 키만 추가, 하드코딩 한국어 0
- [x] TEST-1 vitest GREEN 8 + 2 = 10 케이스
- [x] GATE-2 비대상 diff 0
- [x] eslint 0 warnings on touched files

## TODO → Cursor
- 없음 (Z-OAuth · clicks RPC · analytics date-range 이미 완료)
- **선행 픽스 요청**: `src/features/admin/promo/hooks/usePromoAdmin.ts` L98 (`queryFn: promoAnalyticsSummary` ↔ `(input?: {from,to})` 시그니처 mismatch) — Cursor sanitation 큐

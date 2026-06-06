
# ROUND Z-3 v1.3.1 (SHIP) · Promo Calendar + Analytics Polish

운영 콘솔 수준의 시각화·탐색·집계 UI. 신규 DB/RPC/API/dependency **0**. `usePromoAdmin` 변경 **0**.

## Data Contract (Z-3, 훅 변경 0 기준)
- **SSOT for timeline/breakdown/top:** `dispatches[]` (+ `campaigns[]` join)
- **clicks:** `analytics.clicks` scalar · `analytics.topChannel` · `clicks[]` 배열 없음
- Pure fn: `dailyDispatchBuckets`, `topCampaignByDispatches`
- **기간 필터 KPI 파생:**
  - dispatches / impressions(= filteredDispatches.length × 100) / breakdown / timeline / top → **filtered dispatches 기준**
  - clicks / CTR → **전체 집계 유지** + `analytics.clicksScopeNote`
- **Loading UX (mock flash 가림):** `persisting && loading` → Calendar/Analytics **panel 전체 Skeleton**. (analyticsQuery.isLoading 미노출 + 로딩 중 mock fallback 반환은 Cursor TODO.)
- **Empty state:** `analytics.dispatches === 0 && analytics.clicks === 0` (mock seed clicks 2 → demo 거의 비노출 정상)

## Status 색 (semantic 토큰만, raw hex 0)
- `draft` = muted
- `scheduled` / `publishing` = accent
- `done` = emerald
- `failed` = rose

## Red Line (MUST NOT)
- `supabase/`, `src/integrations/supabase/`, `src/lib/api/`, `src/lib/promo/*.server.ts`, `src/routes/api/**` 수정 0
- `usePromoAdmin` 내부 로직/계약 변경 0
- 신규 chart npm 0 — CSS/SVG/Canvas 만
- zustand 0 · vite.config 0 · walletStore 0 · 인라인 mock 0
- CampaignTable / StudioPanel / ChannelMatrix 리팩터 0

## A. CalendarBoard → 월간 운영 캘린더 (AC-CAL-*)
**파일:** `CalendarBoard.tsx` (+ `CalendarMonthGrid.tsx`, `CalendarDayDetail.tsx`)

- 7열 월간 그리드, 요일 헤더 = `labels.ko.calendar.weekdays`
- 이전/다음 달 nav + "오늘" 버튼 (aria-label)
- Day cell: scheduledAt 있는 모든 캠페인 pill (draft 포함), status 색 = 위 5종 매핑
- **CAL-4 pill copy 규칙:**
  - **pill 본문 = 캠페인 `title` truncate**
  - status는 좌측 dot/보더 색 + legend의 `promoStatusLabel(status)`
  - `title` 속성(툴팁) = `"{title} · {promoStatusLabel(status)} · {scheduledAt}"`
- Pill/날짜 클릭 → Day detail: 캠페인 목록 + RiskBadge + 채널 수 + `datetime-local` → `scheduleCampaign(id, iso)`
- 빈 날짜 → `calendar.dayEmpty`
- 그리드/리스트 토글 — 기존 리스트 뷰 `listView` 분기 유지 (회귀 방지)
- 모바일 390px: `overflow-x-auto`
- 월 전환: **`__root.tsx` 전역 `LazyMotion` 사용 → `m.div` fade/slide만, nested wrap 0**
- `persisting && loading` 시 panel 전체 Skeleton
- `calendar.hintConfigured`: "Supabase에 저장 · cron이 due 시 발송"

## B. Analytics → 성과 대시보드 (AC-ANA-*)
**파일:** `AnalyticsDashboard.tsx` + sub (`KpiRow`, `ChannelBreakdown`, `DispatchTimeline`, `PeriodFilter`, `DispatchSparkline`). `AnalyticsKpis.tsx`는 thin re-export.

- **ANA-0:** `persisting && loading` → 대시보드 전체 Skeleton
- KPI row: impressions / clicks / CTR / dispatches
- Channel breakdown: filtered dispatches 기준, CSS flex bar, `PROMO_CHANNEL_LABELS_KO`
- Timeline: filtered dispatches 최신 20건 (sentAt/channel + `promoStatusLabel` badge + 캠페인 title)
- Top campaign: `topCampaignByDispatches` 1위 + `analytics.topChannel` 보조
- PeriodFilter 7d/30d/all — Data Contract 규칙
- Sparkline: SVG polyline `dailyDispatchBuckets`
- Empty state: dispatches=0 && clicks=0 → `<Link to="/admin/promo/channels">` CTA

## C. Pure logic + tests
**`src/lib/promo/calendarGrid.ts`** (server import 0)
- `export type DayCell = { date: Date; ymd: string; inMonth: boolean; campaigns: PromoCampaign[] }`
- `ymdKey(iso)` (local 일관)
- `groupCampaignsByDay(campaigns)`
- `buildMonthGrid(year, month, campaigns)` (6주 고정)
- `shiftMonth(year, month, delta)`

**`src/lib/promo/analyticsAggregate.ts`**
- `channelBreakdown(dispatches)`
- `filterByPeriod<T>(items, getDate, from, to)`
- `periodRange(now, "7d"|"30d"|"all")`
- `dailyDispatchBuckets(dispatches, days)`
- `topCampaignByDispatches(campaigns, dispatches)`
- `resolveCampaignTitle(campaigns, id)`

**Tests (vitest, ≥4 each):** `calendarGrid.spec.ts` · `analyticsAggregate.spec.ts`

## D. labels.ko (AC-COPY-*)
- `calendar.weekdays/today/prevMonth/nextMonth/gridView/listView/dayEmpty/statusLegend`
- `analytics.period7d/30d/all/channelBreakdown/timeline/topCampaign/emptyCta/ctrTrend/clicksScopeNote`
- Stale 정리: `calendar.hintConfigured`, `analytics.hintConfigured` — "Z-DB/Z-2/로컬 데모" 제거
- `studio.composerHintConfigured`: persisting 시 "Supabase에 저장"
- PromoShell subtitle은 Cursor 큐 (allowlist 밖)

## 파일 allowlist
- `src/features/admin/promo/components/CalendarBoard.tsx` (+ `CalendarMonthGrid.tsx`, `CalendarDayDetail.tsx`)
- `src/features/admin/promo/components/AnalyticsDashboard.tsx` (+ `KpiRow.tsx`, `ChannelBreakdown.tsx`, `DispatchTimeline.tsx`, `PeriodFilter.tsx`, `DispatchSparkline.tsx`)
- `src/features/admin/promo/components/AnalyticsKpis.tsx` (thin re-export)
- `src/shared/admin/labels.ko.ts`
- `src/lib/promo/calendarGrid.ts`
- `src/lib/promo/analyticsAggregate.ts`
- `src/lib/promo/__tests__/calendarGrid.spec.ts`
- `src/lib/promo/__tests__/analyticsAggregate.spec.ts`
- `src/routes/admin/promo/calendar.tsx` (thin)
- `src/routes/admin/promo/analytics.tsx` (thin)

## Cursor TODO (handoff)
- `// TODO(Cursor): list_promo_clicks RPC + usePromoAdmin clicks[] 노출 — real CTR sparkline`
- `// TODO(Cursor): usePromoAdmin.loading에 analyticsQuery.isLoading 포함`
- `// TODO(Cursor): persisting && loading 시 mock fallback 반환 금지 (mock flash 제거)`
- `// TODO(Cursor): PromoShell subtitle persisting 분기 (ai.subtitleConfigured 완성)`
- `// TODO(Cursor): promo analytics RPC with date range — client filter is Z-3 demo only`
- `// TODO(Cursor): pg_cron schedule — docs/PROMO_CRON_SETUP.md`

## Acceptance Checklist
- [ ] CAL-1 월간 그리드에 scheduledAt 캠페인 pill (status 5종 색)
- [ ] CAL-2 pill/날짜 클릭 → Day detail + `scheduleCampaign`, 리스트 뷰 회귀 없음
- [ ] CAL-3 `calendarGrid.spec` GREEN
- [ ] CAL-4 pill 본문 = title truncate · legend/tooltip에 `promoStatusLabel`
- [ ] ANA-0 `persisting && loading` → panel 전체 Skeleton
- [ ] ANA-1 채널 breakdown + 발송 타임라인 (dispatches SSOT)
- [ ] ANA-2 기간 필터 7d/30d/all — Data Contract 파생, clicks/CTR scopeNote
- [ ] ANA-3 `analyticsAggregate.spec` GREEN
- [ ] COPY-1 calendar/analytics/studio hintConfigured stale 제거 (PromoShell 제외)
- [ ] GATE-1 eslint 0 warn · vitest GREEN · build GREEN
- [ ] GATE-2 `supabase/` · `lib/api/` · `integrations/supabase/` · `lib/promo/*.server.ts` · `routes/api/**` diff 0

## 디자인
cosmic bg + glass-1/2, font-numeric KPI, status semantic 토큰, 60fps 월 전환, aria-label.

## 라운드 종료 보고 (ROUND_REPORT_TEMPLATE.md)
변경 파일 · 비대상 Y/N · eslint/test/build · Cursor TODO.

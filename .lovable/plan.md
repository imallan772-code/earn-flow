# ROUND Z — Phase Z-0 실행 플랜 (최종 SSOT)

승인된 SSOT 그대로 착수. AI 실호출·실발행·DB insert는 본 Phase에서 하지 않는다 (Z-1~3 / Cursor Z-DB 분리).

## 1. Scope (Z-0 only)

- `/admin/promo` 웹 SSOT, 7-tab shell
- `features/admin/promo/*` 파일 트리
- client mockStore (브라우저 인메모리, server in-memory 금지)
- pure lib (`src/lib/promo/*`): utm, risk, abSplit, schedule
- server fn / route **stub만** (실 dispatch·AI 호출·DB write 없음)
- vitest ≥8 (pure lib + SSRF guard 1건)
- `apps/admin` diff 0, `nav.ts` Promo additive only

## 2. 파일 트리

```text
src/routes/admin/promo/
  route.tsx                  # layout + 7-tab nav
  index.tsx                  # → studio redirect
  studio.tsx                 # AI Composer (mock)
  campaigns.tsx
  calendar.tsx
  channels.tsx
  assets.tsx
  analytics.tsx
  settings.tsx

src/features/admin/promo/
  components/
    PromoTabs.tsx
    StudioPanel.tsx
    LivePreview.tsx          # 5 type preview (mock)
    ChannelMatrix.tsx
    CampaignTable.tsx
    CalendarBoard.tsx
    AssetGrid.tsx
    AnalyticsKpis.tsx
    RiskBadge.tsx
    AbSplitBar.tsx
  store/
    mockStore.ts             # zustand client-only, 캠페인/변형/디스패치/클릭/에셋/세팅
  types.ts                   # 로컬 stub (supabase types.ts 절대 import 금지)

src/lib/promo/
  utm.ts                     # buildUtmUrl(slug, ch, campaign)
  risk.ts                    # scanRiskLocal(text) → {score, flags[]}
  abSplit.ts                 # splitVariants(variants, ratio)
  schedule.ts                # nextTickAt(cron, tz)
  ssrf.ts                    # assertSafeUrl(url)
  index.ts

src/lib/promo/promo.functions.ts
  composePromo (stub: throws "Z-1")
  publishCampaign (stub)
  testChannel (stub)
  listCampaigns / listDispatches / listAssets (mock pass-through)

src/routes/api/public/r.$slug.ts          # 302 to target (UTM merge), click insert는 stub log만
src/routes/api/public/cron.promo-tick.ts  # HMAC 검증 + no-op 200

src/lib/promo/__tests__/
  utm.test.ts
  risk.test.ts
  abSplit.test.ts
  schedule.test.ts
  ssrf.test.ts               # SSRF guard (private IP/localhost 차단)
  mockStore.test.ts
  redirect.test.ts           # /r/$slug UTM merge
  cron.test.ts               # HMAC reject
```

총 8개 테스트.

## 3. 7-tab 구성

| Tab | 내용 (Z-0 mock) |
|-----|-----------------|
| Studio | brief 입력 → "Generate" → mockStore에 plan/variants/hero placeholder, LivePreview 5종 |
| Campaigns | mockStore 캠페인 테이블, status badge, RiskBadge |
| Calendar | 캠페인 scheduled_at drag (mockStore 업데이트) |
| Channels | 9 채널 카드 (Telegram/Discord/Slack/X/LinkedIn/TikTok/Resend/Zapier/Copy-Mode), verify()/send() mock |
| Assets | 그리드 + upload placeholder (mockStore) |
| Analytics | KPI 카드 (impressions/clicks/CTR) — mockStore 집계 |
| Settings | webhook URL / HMAC secret 입력 (mockStore, 저장 noop) |

모바일 <1024px: 1-column + bottom sheet nav.

## 4. AI / 채널 / DB 처리

- AI: `composePromoBrief` / `composePromoVariants` / `scanPromoRisk` / `translatePromo` — **이번엔 stub 함수만 등록**, 실 호출은 Z-1.
- 채널: 9 adapter 인터페이스 (`verify()`, `send()`)만 정의. 실 송신 X.
- DB: 본 Phase는 `supabase/` migration 추가 금지. Cursor Z-DB PR이 병렬로 6 테이블 + RLS + `record_promo_click` RPC + `pg_cron` 처리.
- click insert: `/r/$slug`는 redirect만, RPC insert는 Cursor Z-DB 머지 후 Z-1에서 연결.

## 5. Red Line

금지:
- `supabase/`, `src/integrations/supabase/types.ts`, `src/lib/api/**` 수정
- `apps/admin` 7-tab 중복
- server fn 내 `new Map()` / module-level `let arr=[]` (in-memory store)
- `package.json` 신규 dependency
- 단일 `composePromo` 4-step sync (multi-fn 분리 유지)
- `walletStore.ts`, `LiveBetsStore.ts`, `botGenerator.ts`, 기존 admin 3 화면 diff
- `nav.ts` Promo additive 외 변경

## 6. Acceptance

- 7 tab 라우트 GREEN, mobile 1-col
- pure lib 4종 + SSRF guard + redirect + cron 합쳐 ≥8 tests PASS
- `bun run lint:strict` 0 warn
- `bun run check` GREEN
- `rg "new Map\\(|let .*=\\s*\\[\\]" src/lib/promo/promo.functions.ts src/routes/api/public/` → 0
- `git diff supabase/ src/integrations/supabase/types.ts src/lib/api/ apps/admin/` → 0

## 7. Out of scope (Z-1+ / Cursor)

- 실제 Gemini/GPT/이미지 호출 (Z-1)
- 실 채널 OAuth + 발행 (Cursor Z-OAuth)
- DB migration / RLS / pg_cron / click RPC insert (Cursor Z-DB, 병렬)
- A/B winner auto-pick, video shorts, ElevenLabs (Z-2~3)

승인 시 Build 모드 전환 후 위 트리 그대로 작성.

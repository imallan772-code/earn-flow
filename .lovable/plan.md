
# Phase Z-2 v1.3 — Promo Engine (최종, Lovable 착수)

Z-1 v3.2 위 누적. v1.2 + 검토 4줄(경로 · publish fn 분리 · is_admin gate · imageUrl read-back TODO) 반영.

## 1. 목표 (3축)
- Studio `imagePrompt` → SSE 이미지 생성 → 미리보기 (Storage upload는 Cursor)
- ChannelMatrix → webhook/telegram **실 adapter** (OAuth 채널 stub + 한글 안내, SSRF 차단)
- `cron/promo-tick` → HMAC + dispatchTick pure 골격 (DB scan은 Cursor)

## 2. v1.3 추가 (검토 4줄)

| # | 항목 | 결정 |
|---|------|------|
| v1.3-1 | **mapCampaign 경로 SSOT** | 수정 파일은 **`src/features/admin/promo/lib/mapCampaign.ts`** (features `lib/` 하위, lib/api 아님). `image_url ↔ variant.imageUrl` 한 필드 SSOT |
| v1.3-2 | **publish server fn 역할 분리 (이름 박기)** | ChannelMatrix **「지금 발행」** → `runPromoCronTick` (scheduled due 캠페인 fan-out 전용) · CampaignTable 행 **「발행」** → `publishPromoCampaign(campaignId, channel?)` (단건 발행). 두 fn은 별도 export, UI에서 절대 합치지 않음 |
| v1.3-3 | **adminGate RPC SSOT = `is_admin`** | `adminGate.server.ts`: `supabase.auth.getUser(token)` → `supabase.rpc("is_admin")` boolean === true. client `fetchIsAdmin`과 동일 RPC. (`assert_is_admin` throw 방식 ❌, `is_admin` boolean 통일) |
| v1.3-4 | **imageUrl read-back은 Cursor TODO** | 세션 내 `variant.imageUrl` preview OK. Supabase reload 후 유실은 **lib/api/promo.ts `toVariant` `image_url → imageUrl` 매핑** 필요 — Z-2 범위 밖, Cursor 큐 |

## 3. v1.2/v1.1 유지

| # | 결정 |
|---|------|
| v1.1-1 | 이미지 모델: Imagen/Gemini image endpoint (GEMINI_API_KEY). Flash text로 image 호출 ❌. 미지원/키 없음 → `IMAGE_NOT_CONFIGURED` + placeholder. base64 → data URL preview (Storage Cursor) |
| v1.2-C/v1.1-2 | image-stream admin gate: `assertAdminRequest` 통과 전 stream 시작 ❌, 미인증/비admin → 401 JSON |
| v1.1-3 | cron route → `{ok:true,enqueued:0,sent:0,failed:0,note:"CRON_DB_READ_CURSOR_TODO"}` 200. cron route에서 `promoListCampaigns` 호출 ❌. `runPromoCronTick` server fn은 admin UI 전용 |
| v1.1-4 | `getPromoSettingsExtended` server fn → `admin_get_promo_settings` raw `default_utm` parse → telegram 필드 read-back. lib/api/promo.ts 수정 0 |
| v1.1-5 | `channels/webhook.ts` outbound URL → `src/lib/promo/ssrf.ts` `assertSafeUrl` 필수. 실패 → `{ok:false,code:"SSRF_BLOCKED"}`. telegram(`api.telegram.org`) 고정 URL은 SSRF 대상 ❌ |
| v1.2-A | `PromoVariant.imageUrl?: string` 타입 추가 |
| v1.2-B | 「지금 발행」/「발행」 UI 배치 (v1.3-2 역할 분리) |

## 4. 구현 범위

### A. 이미지 생성 SSE
- **신규** `src/lib/promo/image.server.ts` — `resolveImageProvider()` (Imagen/Gemini image, Flash 금지) · `streamPromoImage(prompt,{signal})` · envelope `{ok,data:{base64|url}}|{ok:false,code:"IMAGE_NOT_CONFIGURED"|"IMAGE_ERROR"|"IMAGE_TIMEOUT"}`
- **신규** `src/lib/promo/adminGate.server.ts` — `assertAdminRequest(request)`: bearer/cookie 추출 → `supabase.auth.getUser(token)` → `supabase.rpc("is_admin")` boolean === true. 실패 → throw 401 envelope
- **신규 route** `src/routes/api/admin/promo/image-stream.ts` — handler 진입 즉시 `await assertAdminRequest(request)` (실패 시 401 JSON before stream) → `text/event-stream` (`progress|chunk|done|error`) · 키/prompt leak 0
- **VariantEditorCard** — 「이미지 생성」 + AbortController · 완료 → `usePromoAdmin().addAsset()` + variant `imageUrl` 반영
- **LivePreview** — `variant.imageUrl` → `<img>`

### B. 채널 Adapter + 발행 fn 분리
- **신규** `src/lib/promo/channels/{types,webhook,telegram,resend,index}.ts`
  - `webhook.ts`: POST + `assertSafeUrl` 통과 필수
  - `telegram.ts`: Bot API sendMessage (token/chatId는 settings `default_utm` JSON, DB migration 0)
  - `resend.ts`: stub `NOT_IMPLEMENTED`
  - OAuth(x/linkedin/tiktok): stub `{ok:false,code:"OAUTH_REQUIRED"}`
- **promo.functions.ts** (export 2개 분리 유지)
  - `publishPromoCampaign(campaignId, channel?)` — **단건 발행** (CampaignTable 행 「발행」 전용). adapter 호출 + `promoRecordDispatch`
  - `runPromoCronTick()` — **scheduled due 캠페인 fan-out** (ChannelMatrix 「지금 발행」 전용, cron route 호출 ❌)
  - `testChannel(channel)` — verify/dry-run
  - `getPromoSettingsExtended` — telegram read-back
  - handler 내부 `promoListCampaigns`/`promoRecordDispatch` import 호출 OK (lib/api 파일 수정 0)
- **ChannelMatrix.tsx** — mockVerify/mockSend 제거 → `useServerFn` · 상단 「지금 발행」 = `runPromoCronTick` · `[데모]` 제거
- **CampaignTable.tsx** — 행별 「발행」 액션 = `publishPromoCampaign(row.id)`
- **SettingsPanel.tsx** — telegram bot token/chat id 입력 (save: updateSettings → default_utm merge / load: `getPromoSettingsExtended`)
- **types.ts** — `PromoVariant.imageUrl?: string` · `PromoSettings.telegramBotToken? / telegramChatId?`
- **`src/features/admin/promo/lib/mapCampaign.ts`** — `image_url ↔ variant.imageUrl` SSOT (`utm.heroUrl` 사용 시 둘 중 하나만)

### C. Cron dispatch 골격
- **신규** `src/lib/promo/dispatchTick.ts` — pure `(campaigns) => {campaignId,channel,variantId}[]`
- **수정** `src/routes/api/public/cron/promo-tick.ts` — HMAC 유지 · `PROMO_CRON_SECRET` 없으면 503 · valid → `{ok:true,enqueued:0,sent:0,failed:0,note:"CRON_DB_READ_CURSOR_TODO"}` 200
- pg_cron 실 등록 ❌ (Cursor)

### D. 한글 SSOT (`labels.ko.ts`)
```
promo.image.{generate,generating,cancel,done,notConfigured,error,timeout}
promo.publish.{publishNow,publishRow,sending,sent,failed,oauthRequired,testOk,testFail,ssrfBlocked}
promo.cron.{notConfigured,tickOk,dbReadCursorTodo}
promo.settings.{telegramToken,telegramChat}
```

### E. 테스트 ≥8 신규
| 파일 | 내용 |
|---|---|
| `channels/__tests__/webhook.spec.ts` | payload · URL 필수 · **SSRF 차단** |
| `channels/__tests__/telegram.spec.ts` | truncate · token missing |
| `lib/promo/__tests__/dispatchTick.spec.ts` | due filter · fan-out |
| `lib/promo/__tests__/image.server.spec.ts` | mock fetch · NOT_CONFIGURED · SSE parse |
| `lib/promo/__tests__/publish.spec.ts` | publishPromoCampaign vs runPromoCronTick 분리 · OAuth stub · webhook success mock · dispatch record |

실 API/실 키 호출 0.

## 5. Red Line (FAIL)
- `supabase/` · `src/integrations/supabase/types.ts` · `src/lib/api/promo.ts` **수정 0** (import 호출은 OK)
- `apps/admin/` diff 0 · `messages.{ko,en}.ts` diff 0 · `nav.ts` additive only
- features에서 `promoMockStore` 직접 import 0
- zustand · 신규 npm dep · `VITE_*` secret · server in-memory store 0
- `process.env` handler 내부 read only
- **Flash text로 image 호출 0**
- **cron route에서 `promoListCampaigns` 호출 0**
- **image-stream route admin gate 통과 전 stream 시작 0**
- **`publishPromoCampaign` ↔ `runPromoCronTick` UI 혼용 0** (역할 분리 강제)

## 6. 파일
```text
신규
  src/lib/promo/image.server.ts
  src/lib/promo/adminGate.server.ts
  src/lib/promo/dispatchTick.ts
  src/lib/promo/channels/{types,webhook,telegram,resend,index}.ts
  src/lib/promo/channels/__tests__/{webhook,telegram}.spec.ts
  src/lib/promo/__tests__/{image.server,dispatchTick,publish}.spec.ts
  src/routes/api/admin/promo/image-stream.ts
  src/features/admin/promo/lib/mapCampaign.ts      ← features lib/ 하위
수정
  src/lib/promo/promo.functions.ts                 ← +publishPromoCampaign, +runPromoCronTick, +testChannel, +getPromoSettingsExtended
  src/routes/api/public/cron/promo-tick.ts
  src/features/admin/promo/components/{VariantEditorCard,LivePreview,ChannelMatrix,SettingsPanel,CampaignTable}.tsx
  src/features/admin/promo/types.ts
  src/shared/admin/labels.ko.ts
  src/routeTree.gen.ts (자동)
```

## 7. 수락 기준
- Studio imagePrompt → 「이미지 생성」 → SSE → preview 이미지 (키 없음 → 한글 `IMAGE_NOT_CONFIGURED` + placeholder)
- ChannelMatrix 「지금 발행」 → `runPromoCronTick` 실행 / CampaignTable 행 「발행」 → `publishPromoCampaign` 실행 (UI 합쳐짐 0)
- adapter 결과 토스트: webhook 성공 · telegram 성공 · OAuth 한글 안내 · SSRF 차단 메시지
- Settings telegram 저장 → reload 후 입력값 복원
- `POST /api/public/cron/promo-tick` + valid HMAC → `{...note:"CRON_DB_READ_CURSOR_TODO"}` 200 (no secret → 503)
- `/api/admin/promo/image-stream` 미인증/비admin → 401 JSON before stream
- `bun run lint:strict` 0 · `bun run check` GREEN · promo tests +8 후 전체 GREEN
- UI 영문 하드코딩 0 (X·LinkedIn 등 고유명사만)

## 8. 스코프 밖 (Cursor 큐)
- `lib/api/promo.ts` `toVariant` **image_url → imageUrl read-back** (v1.3-4)
- Cron 전용 service role RPC (DB scan)
- `lib/api/toSettings` telegram 필드 정식화
- `promo-assets` Storage upload (data URL → bucket)
- Z-OAuth (X/LinkedIn/TikTok)
- Resend Edge · pg_cron 실등록
- supabase migration · types regen · A/B winner · ElevenLabs · shorts · apps/admin · vite.config

## 9. 라운드 종료 보고
변경 파일 목록 / Red Line Y·N 표 / lint·test·build 결과 / Cursor TODO

한 줄: Z-2 v1.3 = imagePrompt SSE(Imagen, `is_admin` gate) + webhook(SSRF)·telegram 실 adapter + 「지금 발행」(`runPromoCronTick`)·행 「발행」(`publishPromoCampaign`) 분리 + cron HMAC 골격 + settings telegram read-back + `PromoVariant.imageUrl` SSOT(features `lib/mapCampaign.ts`) + 한글 + tests 8+. `toVariant` read-back은 Cursor.

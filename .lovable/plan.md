# Phase Z-1 플랜 v3.2 (최종 승인) — 무료 Gemini + AI 카피 + 한글 SSOT

## 목표
Z-0 `composePromo` stub을 실 AI 호출로 교체. Studio에서 brief → 5채널 variants + 리스크 점수를 한글 UI로 표시.

- 1순위: `GEMINI_API_KEY` (Google AI Studio, Flash 무료) — Cursor 로컬·GitHub 배포 SSOT
- 2순위: `LOVABLE_API_KEY` (Lovable AI Gateway) — Lovable preview만
- 3순위: `buildFallbackVariants()` 로컬 stub + 한글 토스트

전 UI 문자열 `labels.ko.ts` SSOT. admin 에러 = `ADMIN_KO.promo.errors.*` + `sonner` (messages.{ko,en} diff 0).

## v3.2 추가 결정 (검토 1)

| # | 항목 | 결정 |
|---|---|---|
| v3.2-1 | **subtitle 동기화** | `usePromoAiStatus` 훅 신규 — `PromoShell` + `StudioPanel` 공유. `PromoShell.tsx` 수정 허용 (nav.ts additive-only와 무관). 둘 다 provider 상태 동적 반영 |
| v3.2-2 | **fallback 위치** | `src/lib/promo/fallbackVariants.ts` 분리 → `composeVariants.spec.ts`에서 reuse |
| v3.2-3 | **translate UI** | Z-1 토글 미노출. `translatePromo` export만 유지, 버튼 없음 |

## v3.1 결정 유지

| # | 항목 | 결정 |
|---|---|---|
| v3.1-1 | `getPromoAiStatus` server fn (GET) → `{ configured, provider }`, **키 노출 0** |
| v3.1-2 | `composePromoVariants` 단일 Gemini call (brief+variants+risk). `composePromoBrief`/`scanPromoRisk`는 thin export |
| v3.1-3 | `process.env`는 handler 내부 read only |
| v3.1-4 | `VariantEditorCard.tsx` 분리 |
| 1 | SSE 없음, staggered reveal |
| 2 | Direct `gemini-2.5-flash` / Gateway `google/gemini-3-flash-preview`. Pro 금지 |
| 3 | 에러 코드: `AI_NOT_CONFIGURED` / `AI_RATE_LIMITED` / `AI_ERROR` / `AI_TIMEOUT` / `AI_PARSE_ERROR` / `EMPTY_BRIEF` |
| 4 | `composePromo` 삭제 |
| 5 | `PromoVariant.imagePrompt?: string` |
| 6 | `responseMimeType: "application/json"` + schema |
| 7 | `translatePromo` stub envelope 허용 |

## 스코프 (포함)

### 1. `src/lib/promo/ai.server.ts`
- `resolveProvider()` (handler 내부 process.env read)
- `getModelForProvider(p)` — Direct↔Gateway 모델 map
- `callGemini(messages, { schema, signal }): Promise<AiEnvelope<T>>`
- `parseAiBundle(raw)` — brief + variants[] + risk 통합 + 5채널 누락 patch
- response schema: `{ brief, variants: [...5], risk: { score, flags[] } }`
- envelope: `{ ok: true, data } | { ok: false, code, message? }`

### 2. `src/lib/promo/fallbackVariants.ts` (신규)
- `buildFallbackVariants(brief, channels): PromoVariant[]`
- 순수함수, 테스트 reuse

### 3. 서버 함수 — `src/lib/promo/promo.functions.ts`
| fn | 역할 | call |
|---|---|---|
| `getPromoAiStatus` | provider 상태, 키 노출 0 | 0 |
| `composePromoVariants` | brief+variants+risk 단일 Gemini call | **1** |
| `composePromoBrief` | thin 헬퍼 export | — |
| `scanPromoRisk` | local+AI 병합 헬퍼 export | — |
| `translatePromo` | stub envelope (UI 미노출) | 0 |

`composePromo` 삭제. `listCampaigns`/`listDispatches`/`listAssets` 기존 `lib/api` import 유지.

### 4. `risk.ts` — `mergeRiskScores(local, ai)`
순수함수: `Math.max`, flags union, level 재계산 (`scanRiskLocal` threshold 25/60 재사용).

### 5. 타입
`PromoVariant.imagePrompt?: string` 추가만

### 6. `src/features/admin/promo/hooks/usePromoAiStatus.ts` (신규)
- `getPromoAiStatus` 호출 + React 캐싱
- `PromoShell` + `StudioPanel` 공유

### 7. UI
- `PromoShell.tsx` — subtitle을 hook 결과 기반으로 동적 (예: "Gemini 무료 연결 · 데모 저장" / "AI 미연결 · 로컬 fallback")
- `StudioPanel.tsx` — orchestration; mount 시 hook → 배지/composerHint
- `VariantEditorCard.tsx` (신규) — body/hashtags/cta/imagePrompt/weight 인라인 편집
- 「카피 생성」 → 빈 brief 체크 (`EMPTY_BRIEF` 토스트) → `composePromoVariants` + AbortController
- 5채널 스켈레톤 → staggered reveal
- 실패 시 `buildFallbackVariants` + 코드별 한글 토스트

### 8. LivePreview
mock 5종 (텔레그램/X/LinkedIn/Discord/Slack) + weight 시각화. 편집 없음. 200줄 미만.

### 9. RiskBadge
props: `{ localScore, aiScore?, mergedScore, flags[] }` — merged 표시 + tooltip 분리

### 10. 한글 SSOT — `labels.ko.ts`
- `promo.ai.{generating, cancel, retry, fallback, configured, notConfigured, providerGemini, providerGateway, subtitleConfigured, subtitleFallback}`
- `promo.risk.{low, mid, high, mergedHint, localLabel, aiLabel}`
- `promo.errors.{notConfigured, rateLimited, gatewayError, timeout, parseError, emptyBrief, generic}`

### 11. 테스트 ≥6 (28 + 6 = 34+)
| 파일 | 내용 |
|---|---|
| `ai.server.spec.ts` | mock fetch; resolveProvider; 키 없음; 200/429/500/timeout; Direct vs Gateway fixture |
| `composeVariants.spec.ts` | parseAiBundle; 5채널 정합·누락 patch; fallbackVariants reuse |
| `risk.merge.spec.ts` | local+AI 병합; level 재계산 (25/60) |

실 API 호출 금지.

## 스코프 밖 (Z-2+)
이미지 SSE · 실채널 OAuth · mockStore→`lib/api/promo.ts` swap · pg_cron 실 dispatch · A/B winner·영상·ElevenLabs

## Red Line
- `supabase/` · `src/integrations/supabase/types.ts` · `src/lib/api/` 수정 0
- `apps/admin/` diff 0
- `src/shared/admin/nav.ts` additive only
- `src/shared/i18n/messages.{ko,en}.ts` diff 0
- 서버 fn `new Map()` / module-level mutable / module-level `process.env` 금지
- 신규 npm dep 금지 (fetch + zod)
- `VITE_*` AI 키 금지
- **`PromoShell.tsx` 수정 허용** (Red Line 외)

## 파일 변경
```text
신규
  src/lib/promo/ai.server.ts
  src/lib/promo/fallbackVariants.ts
  src/lib/promo/__tests__/ai.server.spec.ts
  src/lib/promo/__tests__/composeVariants.spec.ts
  src/lib/promo/__tests__/risk.merge.spec.ts
  src/features/admin/promo/hooks/usePromoAiStatus.ts
  src/features/admin/promo/components/VariantEditorCard.tsx
수정
  src/lib/promo/promo.functions.ts
  src/lib/promo/risk.ts
  src/features/admin/promo/types.ts
  src/features/admin/promo/components/PromoShell.tsx     ← subtitle 동적
  src/features/admin/promo/components/StudioPanel.tsx
  src/features/admin/promo/components/LivePreview.tsx
  src/features/admin/promo/components/RiskBadge.tsx
  src/shared/admin/labels.ko.ts
```

## 수락 기준
- `/admin/promo/studio` brief → 「카피 생성」 → 5채널 staggered (전 한글)
- `getPromoAiStatus` provider 표시, 키 미노출 (network·HTML)
- 「카피 생성」 1클릭 = Gemini API 최대 1회
- **`PromoShell` subtitle + Studio composerHint 둘 다 provider 상태 동적**
- `GEMINI_API_KEY` 설정 → Direct Flash 무료
- 키 둘 다 미설정 → fallback + `notConfigured` 토스트
- 429 / timeout / parse / emptyBrief / generic 토스트 분리
- `bun run lint:strict` 0 · `bun run check` GREEN · 테스트 ≥34
- diff 0: `supabase/` · `lib/api/` · `apps/admin/` · `messages.(ko|en).ts`
- `composePromo` export 0 · 서버 fn module-level `process.env` 0 · in-memory 0 · UI 영문 하드코딩 0

## 로컬 무료 AI 셋업
1. Google AI Studio → API 키 발급
2. `.env`:
   ```
   GEMINI_API_KEY=your-key-here
   # GEMINI_MODEL=gemini-2.5-flash
   ```
3. Lovable preview: `LOVABLE_API_KEY` (Gemini 키 없을 때 2순위)

## Cursor 후속 (Z-1 merge 후)
- `.env.example` 주석
- `ai.server.ts` env·envelope·leak 감사
- merge QA: `PromoShell` subtitle 동기화 확인
- `docs/WHOSE-TURN.md` → mockStore↔RPC swap 또는 Z-2

## 한 줄
**Z-1 v3.2 = Gemini Flash 무료 + 단일 1 call + `usePromoAiStatus` 훅 (Shell+Studio 공유) + `fallbackVariants.ts` 분리 + 한글 SSOT + 테스트 34+. translate UI 미노출. SSE·이미지·실발행·DB swap 제외.**

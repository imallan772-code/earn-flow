# ROUND Q-c v1.2 완료 보고

## 변경 파일 (9)

- **신규**: `src/shared/games/ui/PfVerifyPageLink.tsx` — 공유 CTA (TanStack Link, `!serverSeedHash` 시 disabled span)
- `src/features/fair/FairVerifyScreen.tsx` — 하드코딩 한국어 → `t("fair.verify.*")` 전 영역
- `src/features/games/crash/CrashScreen.tsx` — Modal footer fragment + `<PfVerifyPageLink game="crash">`
- `src/features/games/dice/DiceScreen.tsx` — 동일
- `src/features/games/limbo/LimboScreen.tsx` — 동일
- `src/features/games/wheel/WheelScreen.tsx` — + `risk`, `segments` prefill
- `src/features/games/mines/MinesScreen.tsx` — + `mineCount` prefill (clientSeed: seedDraft || store.clientSeed || DEFAULT)
- `src/shared/i18n/messages.ko.ts` — `fair.verify.*` 키 추가 (title/subtitle/home/run/running/shareLink/openFromModal/field.*/game.*/result.*/error.fallback/footer.stake)
- `src/shared/i18n/messages.en.ts` — ko 키 1:1 동기화

## GATE-2 비대상 준수 (Y)

- supabase/ · integrations/supabase/ · lib/api/ · lib/promo/channels/ · oauth/ · routes/api/ · promo.functions.ts · usePromoAdmin.ts diff 0 ✅
- ProvablyFairModal.tsx · verifyPublic.ts · verifySchemas.ts · *Engine.ts diff 0 ✅
- Plinko 미포함 (Q-d) ✅

## 게이트

- `bunx tsc --noEmit`: **GREEN** (0 errors)
- `bunx vitest run src/lib/pf`: **7/7 GREEN** (로직 무변경, 기존 케이스 유지)
- eslint (touched 9 files): **0 warnings / 0 errors** (prettier auto-fix 적용 후)

## AC 체크

- [x] Touch: PfVerifyPageLink(신규) + 5 *Screen.tsx + FairVerifyScreen + messages.ko/en (Modal 변경 0)
- [x] CTA prefill: SERVER_SEED + commit hash + `seedDraft||DEFAULT_CLIENT_SEED` + nonce (+ mines `mineCount` / wheel `risk`,`segments`)
- [x] commit 로딩 전 CTA `disabled` (내부 `!serverSeedHash` span 분기)
- [x] CTA 1클릭 → `/fair/verify` 도착, search prefilled (TanStack Link search 타입 = `verifySearchSchema` 입력, `hash` 키 사용)
- [x] FairVerifyScreen + CTA 라벨 `t("fair.verify.*")` SSOT — 하드코딩 한국어 0
- [x] messages.en 키 1:1 동기화 (Record 타입 검증 GREEN)
- [x] ProvablyFairModal · verifyPublic · verifySchemas · *Engine 변경 0
- [x] Plinko 미포함 (Q-d)
- [x] eslint touched 0 warnings · vitest 7/7 GREEN · tsc GREEN

## 수동 스모크 (참고용)

- /games/crash → PF 모달 열기 → commit 로딩 전 「독립 검증 페이지에서 열기」 disabled (opacity-50) → commit 도착 후 활성 → 클릭 → /fair/verify?game=crash&serverSeed=...&hash=...&clientSeed=...&nonce=... prefill → 「결과 재현」 → commitValid: true + crash point 표시

## TODO → Cursor

- `docs/CURSOR_AUDIT_NOTES.md` Next 갱신: ROUND Q-PR1 ✅ · Q-c Lovable 완료
- `docs/WHOSE-TURN.md` Q-c 완료 라인 추가

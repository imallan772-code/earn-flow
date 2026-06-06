## A′ — ROUND Q-c Polish (최종판 v1.2 · SHIP 승인)

ROUND Q-PR1 (Q-a · Q-b) 완료 전제. PF 모달 → `/fair/verify` 1클릭 prefill + i18n 마감. 수학·verifyPublic·Modal 0 변경.

### Touch Allowlist (확정)

| 파일 | 작업 |
|---|---|
| `src/shared/games/ui/PfVerifyPageLink.tsx` **(신규, ~30줄)** | 공유 CTA. props: `game: VerifyGame, serverSeed, serverSeedHash?, clientSeed, nonce, mineCount?, risk?, segments?`. `<Link to="/fair/verify" search={{ game, serverSeed, hash, clientSeed, nonce, ... }}>` — search 키는 **`hash`**. 라벨 `t("fair.verify.openFromModal")`. commit 미도착 시 `disabled` (내부에서 `!serverSeedHash` 판정으로 통일). |
| `src/features/games/crash/CrashScreen.tsx` | `ProvablyFairModal` footer를 `<><p>{기존 policy}</p><PfVerifyPageLink ... /></>` fragment로 교체 |
| `src/features/games/dice/DiceScreen.tsx` | 동일 |
| `src/features/games/limbo/LimboScreen.tsx` | 동일 |
| `src/features/games/wheel/WheelScreen.tsx` | + `risk`, `segments` prefill (store 값 그대로 — `verifySearchSchema` 10/20/30 enum과 build 검증) |
| `src/features/games/mines/MinesScreen.tsx` | + `mineCount` prefill |
| `src/features/fair/FairVerifyScreen.tsx` | 한국어 하드코딩 → `t("fair.verify.*")` |
| `src/shared/i18n/messages.ko.ts` | `fair.verify.*` 키 추가 |
| `src/shared/i18n/messages.en.ts` | ko 키 1:1 동기화 (Record 타입 정합 필수) |
| `src/lib/pf/__tests__/verifyPublic.spec.ts` | 로직 무변경 → 기존 7 유지 |

### 구현 결정 (확정)

- **CTA 방식**: `ProvablyFairModal` 미수정. Screen이 넘기는 `footer` slot에 fragment로 주입.
- **search 키**: `hash` (URL · buildVerifyShareUrl과 동일).
- **clientSeed 소스**: `seedDraft.trim() || DEFAULT_CLIENT_SEED` — 5 Screen 공통.
- **commit async**: `disabled` until `commitServerSeed(SERVER_SEED).then(setCommit)` 완료.
- **링크**: TanStack `<Link to="/fair/verify" search={...}>` — `routeTree.gen.ts` 타입 = `verifySearchSchema`, `bun run build`가 검증.
- **VerifyGame import**: `@/lib/pf/verifySchemas` (Zod-only, server 없음 — 금지 충돌 없음, enum 변경 0).

### i18n 키 구조 (힌트)

```
fair.verify.title / .subtitle / .home / .run / .running / .shareLink
fair.verify.openFromModal
fair.verify.field.serverSeed / .serverSeedHash / .clientSeed / .nonce / ...
fair.verify.game.crash / .dice / .limbo / .wheel / .mines
fair.verify.footer.stake
```

- **In scope**: FairVerifyScreen 본문 전체 (타이틀/설명/폼 라벨/「검증 중…」/「결과 재현」/legend/empty/error/「홈으로」/Stake footnote/GAMES select) + CTA 라벨.
- **Out of scope**: `ProvablyFairModal` 내부 「취소/닫기」, Screen footer 기존 policy 문구, `VerifyOutcome.label/detail` (Engine 영문 그대로 표시).

### 금지 (Non-touch)

- `src/shared/games/*Engine.ts` · `src/shared/games/ui/ProvablyFairModal.tsx`
- `src/lib/pf/verifyPublic.ts` 게임 switch · `src/lib/pf/verifySchemas.ts` enum
- Plinko Screen · Plinko verify (Q-d deferred)
- Promo GATE-2 8경로 (supabase/, integrations/supabase/, lib/api/, lib/promo/channels/, *.server.ts, routes/api/, promo.functions.ts, usePromoAdmin.ts)

### AC

- [ ] Touch: PfVerifyPageLink(신규) + 5 *Screen.tsx + FairVerifyScreen + messages.ko/en (Modal 변경 0)
- [ ] CTA prefill: SERVER_SEED + commit hash + `seedDraft||DEFAULT_CLIENT_SEED` + nonce (+ mines `mineCount` / wheel `risk`,`segments`)
- [ ] commit 로딩 전 CTA `disabled` (내부 `!serverSeedHash`)
- [ ] CTA 1클릭 → `/fair/verify` 도착, search prefilled, 「결과 재현」 → verifyPublic `commitValid: true` (5게임)
- [ ] FairVerifyScreen + CTA 라벨 `t("fair.verify.*")` SSOT, 하드코딩 한국어 0
- [ ] messages.en 키 1:1 동기화
- [ ] ProvablyFairModal · verifyPublic · verifySchemas · *Engine 변경 0
- [ ] Plinko 미포함 (Q-d)
- [ ] 390px 모바일 회귀 없음
- [ ] eslint touched files 0 warnings · vitest 7+ GREEN · `bun run build` GREEN
- [ ] 수동 스모크 (Crash 1게임): PF 모달 → 「독립 검증」 (commit 후 활성) → /fair/verify prefill → 「결과 재현」 commitValid + crash point
- [ ] ROUND_REPORT — Promo GATE-2 diff 0 명시

### TODO → Cursor

- `docs/CURSOR_AUDIT_NOTES.md` Next 갱신: Q-PR1 ✅ · Q-c Lovable 완료
- `docs/WHOSE-TURN.md` Q-c 라인 추가

---

## 대안

- **C. STANDBY 유지** — Z-6 AC 대기.

## 사용자 선택

- **A′ 진행** — Q-c v1.2 (build 모드 전환 후 착수)
- **C 유지** — STANDBY
# ROUND L-1 — Crash · Cursor audit (2026-06-06)

**HEAD:** `69cbb33` — Lovable merge  
**Cursor audit:** PASS — `lint:strict` 0 warn · `bun run check` **122** tests GREEN · build OK

---

## 변경 파일 (Lovable)

| 구분 | 경로 |
| ---- | ---- |
| 수정 | `src/features/games/crash/CrashScreen.tsx` |
| 수정 | `src/shared/games/crash/CrashCanvas.tsx` |
| 수정 | `src/shared/games/state/persistedGameState.ts` — `ActiveCrashRound`, `clientSeed`, `activeRound` |
| 수정 | `src/shared/games/rules/gameRules.ts` — CRASH_RULES 단축키 |
| 수정 | `src/shared/games/ui/BetSummaryPanel.tsx` — `holdConfirmMs?` optional (live+onCashout only) |
| 신규 | `src/features/games/crash/CrashMultiplierBadge.tsx` |
| 신규 | `src/shared/games/state/__tests__/crashStore.persist.spec.ts` (3) |
| 신규 | `src/shared/games/state/__tests__/crashStore.restore.spec.ts` (5) |

## 비대상 준수

- [x] `CrashEngine.ts` 0-diff
- [x] `StakeBetPanel.tsx` 0-diff
- [x] walletStore / supabase / lib/api / vite.config 0-diff
- [x] Crash 외 5게임 Screen 0-diff
- [x] crashStore version=2 · key `phonara.gamestate.crash.v2`
- [x] `useGameRound` 미도입 · 4-phase 유지
- [x] `bettingRoundKey={nonce}` · `settledRef` · refund-on-unmount 보존
- [x] RightRail / useDesktopLayout 미도입 (P-3 defer)

## 게이트

| 항목 | 결과 |
| ---- | ---- |
| `bun run lint:strict` | GREEN (0 warn) |
| vitest | GREEN (**122** tests, +8) |
| build | GREEN |

## 알려진 이슈

- **CrashScreen ~589줄** (Lovable 보고 595). 목표 ≤250 **미달** — 수용.
  - 4-phase + activeRound betting/running 복원 + PF refund. Wheel/Dice single-step 대비 베이스라인 큼.
  - Header/PF 분리 → Cursor 후속 chore.

## TODO → Cursor (후속)

- ROUND **M** Plinko (Lovable)
- P-3 Crash RightRail + desktop LiveBetsFeed 분기
- (선택) CrashScreen Header/PF rows 추출

## TODO → Supabase

없음 (demo-only)

## 수동 QA (사용자/Cursor)

- [ ] betting → manual cashout (win)
- [ ] betting → bust (loss)
- [ ] auto-cashout target
- [ ] refresh betting / running — 잔액 불변, 이중 debit 0
- [ ] PF seed + 미정산 refund
- [ ] hotkeys · reduced-motion · 타 게임 auto 3라운드

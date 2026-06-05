# ROUND K — Dice 끝판왕 · Cursor audit (2026-06-06)

**HEAD:** `e4273d9` — Lovable merge  
**Cursor audit:** PASS — `lint:strict` 0 warn · `bun run check` 114 tests GREEN · build OK

---

## 변경 파일 (Lovable)

| 구분 | 경로 |
| ---- | ---- |
| 수정 | `src/features/games/dice/DiceScreen.tsx` |
| 수정 | `src/shared/games/dice/DiceSlider.tsx` |
| 수정 | `src/shared/games/dice/DiceResultDisplay.tsx` |
| 수정 | `src/shared/games/state/persistedGameState.ts` |
| 수정 | `src/shared/games/rules/gameRules.ts` |
| 신규 | `src/shared/games/state/__tests__/dice.persist.spec.ts` |

## 비대상 준수

- [x] walletStore 스키마 변경 없음
- [x] supabase/ · lib/api/ · vite.config.ts 변경 없음
- [x] `DiceEngine.ts` 0-diff
- [x] `StakeBetPanel` 계약 0-diff
- [x] Dice 외 5게임 Screen 0-diff
- [x] diceStore version=2 · key `phonara.gamestate.dice.v2` 불변
- [x] RightRail / useDesktopLayout 미도입 (P-3 defer)

## 게이트

| 항목 | 결과 |
| ---- | ---- |
| `bun run lint:strict` | GREEN (0 warn) |
| vitest | GREEN (**114** tests, +3 `dice.persist.spec`) |
| build | GREEN |

## Cursor grep 감사

- `wallet.credit/tryDebit` in mocks/non-Screen: 없음
- Dice `.rpc(`: 없음
- `routeTree.gen.ts`: pull 후 local diff → **restore** (커밋 금지)

## 알려진 이슈

- **DiceScreen 라인 수:** ~370줄. 로드맵 목표 ≤210 **미달**.
  - Wheel SSOT(GameShell 8슬롯 + PF rows + hotkeys) 동일 비용. Wheel 대비 -74줄.
  - Header/PF rows 분리 → 후속 Cursor chore (본 라운드 범위 밖).

## TODO → Cursor (후속)

- ROUND **L-1** Crash (Lovable)
- P-3: Dice RightRail + `!isDesktop` LiveBetsFeed 분기
- (선택) `DiceHeader` / `DiceFairRows` 추출 → Screen ≤210

## TODO → Supabase

없음 (demo-only)

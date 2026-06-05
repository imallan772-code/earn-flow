# ROUND L-2-pre — Limbo 1-slot Revert + Legacy Migrate

SSOT: [`docs/lovable/rounds/ROUND-L-2-PRE-LIMBO.md`](docs/lovable/rounds/ROUND-L-2-PRE-LIMBO.md) (on `main`). 본 플랜과 충돌 시 SSOT 문서 우선.

L-2 PR2 진입 전 선행 라운드. Limbo를 단일 슬롯으로 환원하고 기존 2-slot 저장본을 마이그레이트 (양 슬롯 refund 후 단일화).

## Locked decisions (SSOT 반영 3건)

| 항목 | 결정 |
|---|---|
| 구조 | `activeRound: ActiveLimboRound \| null` + 단일 `lastOutcome` (Crash/Mines 동형) |
| refund `roundId` | **`` `n${nonce}` ``** (debit과 동일). `liveBetId` 금지 — RPC `MONEY_ROUND_NOT_FOUND` 방지 |
| refund 타이밍 | sync `hydrate` 내부 금지 (auth 없음). migrate는 `pendingLegacyRefunds`만 채우고, **LimboScreen mount effect**에서 `useGameWallet.refund` drain |
| Store version | limbo **v2** (`phonara.gamestate.limbo.v2`) 신규. v1 multi-slot은 1회 read → migrate → v2 persist |
| Legacy fold | 양 슬롯 active면 둘 다 refund. `activeRound = null` (UI carry-over 없음). `lastOutcome = lastOutcomeBySlot.find(Boolean) ?? lastOutcome ?? null` |

## Files

### 변경
1. **`src/shared/games/shell/createGameStore.ts`**
   - Optional `migrate?: (parsed: unknown, initial: T) => T` 파라미터 추가 (기본: 기존 `{ ...initial, ...parsed }`)
   - 다른 게임 호출부 0-diff

2. **`src/shared/games/state/persistedGameState.ts`**
   - `LimboPersisted`: `activeRounds` / `lastOutcomeBySlot` / `activeSlot` 제거
   - 추가: `activeRound: ActiveLimboRound | null`, `pendingLegacyRefunds?: { amount: number; nonce: number }[]`
   - `ActiveLimboRound`: `slot` 제거
   - `limboStore` version `1 → 2`. migrate 콜백:
     - v2 키 없으면 v1 (`phonara.gamestate.limbo.v1`) 1회 read 시도
     - `parsed.activeRounds`가 튜플이면 non-null 항목별 `{ amount, nonce }` → `pendingLegacyRefunds` push
     - `lastOutcome = parsed.lastOutcomeBySlot?.find(Boolean) ?? parsed.lastOutcome ?? null`
     - `activeRound = null`
     - legacy 키들 드롭

3. **`src/features/games/limbo/LimboScreen.tsx`**
   - `LimboMultiSlot` import/사용 제거
   - 단일 `useGameRound`, 단일 `LimboDisplay` + 단일 `StakeBetPanel` (Crash 패턴)
   - `activeSlot` / 듀얼 settled refs / 듀얼 settle effect 제거
   - `placeSlot`/`settleSlot` → single `place`/`settle` (`roundId: \`n${nonce}\``)
   - PF `applySeed`: `activeRound = null`만 (full refund RPC는 L-2 PR2)
   - **신규 mount effect (1회)**:
     - `pendingLegacyRefunds` 순회 → `void refund(amount, { game: 'limbo', roundId: \`n${nonce}\` }).catch()`
     - drain 후 **즉시** `limboStore.set((s) => ({ ...s, pendingLegacyRefunds: [] }))` → v2 persist
     - → 재진입/재마운트 시 이중 refund 방지 (idempotent + 클리어 둘 다)
   - hotkey `1`/`2` (슬롯 전환) 제거

### 삭제
4. **`src/features/games/limbo/LimboMultiSlot.tsx`**

### Tests
5. `src/shared/games/state/__tests__/limboStore.persist.spec.ts` — v2 단일 슬롯 필드로 재작성
6. `src/shared/games/state/__tests__/limboStore.restore.spec.ts` — 단일 `activeRound` 라이프사이클로 재작성
7. **신규** `src/shared/games/state/__tests__/limboStore.migrate.spec.ts`
   - 양 슬롯 active v1 저장본 → `pendingLegacyRefunds.length === 2`, `activeRound === null`
   - slot[0]만 active → `pendingLegacyRefunds.length === 1`
   - 이미 v2 shape → mutation 없음
   - **스코프 한정**: 본 spec은 `pendingLegacyRefunds` 채움만 검증. 실제 `refund()` RPC 호출 검증은 LimboScreen mount effect (별도 컴포넌트 spec 또는 manual QA) 담당. `useGameWallet` mock 불필요 — AC-pre-6 충족 가능.

## Acceptance

| AC | 내용 |
|---|---|
| AC-pre-1 | `LimboPersisted`에 `activeRounds` / `lastOutcomeBySlot` / `activeSlot` 부재 |
| AC-pre-2 | legacy v1 hydrate → `pendingLegacyRefunds` 채워짐. mount drain은 `roundId: \`n${nonce}\`` 호출 + 직후 store에서 클리어 |
| AC-pre-3 | `LimboScreen` 단일 패널. real/demo 모드 격리 |
| AC-pre-4 | `LimboMultiSlot.tsx` 삭제 + import 0 |
| AC-pre-5 | `bun run check` GREEN |
| AC-pre-6 | migrate + persist + restore spec 통과 |

## Manual QA

1. localStorage `phonara.gamestate.limbo.v1` 양 슬롯 active 상태 수동 주입
2. `/games/limbo` 진입 → 단일 패널. 잔액에 양 슬롯 stake 환불 반영 (demo 즉시 / real RPC 후)
3. 새로고침 재진입 → `pendingLegacyRefunds` 비어있음, refund 재호출 없음 (이중 차감 방지 확인)
4. 신규 place → settle 정상
5. PF seed 변경 → nonce 0, `activeRound = null`
6. real ↔ demo 토글 → 잔존 라운드 없음

## Boundaries (0-diff)

- `supabase/**`
- `src/integrations/supabase/types.ts`
- `src/lib/api/**`
- 다른 게임 (Dice/Crash/Mines/Wheel/Plinko) 화면/스토어

## Non-goals (L-2 PR2)

- `useUnmountRefund` 훅 추출 (Crash + Mines + Limbo)
- StakeBetPanel mode-aware integer clamp
- Dice/Wheel PF block toast
- Crash/Mines/Limbo PF refund with meta (legacy pending drain 제외)
- hold 350ms (L-3)

## Workflow

```text
L-2-pre (Lovable) → review → merge
    ↓
L-2 PR2 (Lovable) — 5-game cancel matrix
    ↓
L-3 (hold 350ms)
```

## Risk

- mount drain refund Promise는 fire-and-forget. 실패 시 다음 reload에 재시도 (idempotent RPC + 클리어). orphan reconciliation job은 L-3+ defer.
- v1 → v2 키 전환: v1 잔여 localStorage는 migrate 1회 read 후 그대로 둠 (덮어쓰지 않음). 향후 cleanup 라운드에서 제거.

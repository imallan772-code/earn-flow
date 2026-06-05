# ROUND L-2-pre — Limbo 1-slot Revert + Legacy Migrate

L-2 PR2 진입 전 선행 라운드. Limbo를 초기 단일 슬롯 구조로 환원하고, 기존 2-slot 저장본을 안전하게 마이그레이트(양 슬롯 refund 후 단일화)한다.

**Owner:** Lovable · **Prerequisite:** L-2 PR1 on `main` · read [`docs/CURSOR_AUDIT_NOTES.md`](../../CURSOR_AUDIT_NOTES.md) (`L2-pre` blocking)

---

## Scope (locked)

| 항목 | 결정 |
|------|------|
| 목표 구조 | 단일 슬롯 — `activeRound: ActiveLimboRound \| null`, `lastOutcome` 단일 (Crash/Mines 동형) |
| Legacy migrate | 양 슬롯 active 시 **각각 refund** 후 단일로 fold (`activeRound = null`) |
| refund `roundId` | **`n${nonce}`** (debit과 동일). `liveBetId` 사용 금지 |
| refund 경로 | real: `refund(amount, { game: 'limbo', roundId: \`n${nonce}\` })` via `useGameWallet` · demo: `wallet.refund` |
| Store version | limbo **v2** (`phonara.gamestate.limbo.v2`) — v1 multi-slot은 migrate 후 v2에 persist |
| Non-goal | 5-game cancel matrix, StakeBetPanel clamp, `useUnmountRefund` — **L-2 PR2** |

---

## Cursor corrections (must follow)

### 1. `roundId` — not `liveBetId`

```ts
// WRONG
refund(amount, { game: "limbo", roundId: ar.liveBetId });

// CORRECT — same as placeSlot tryDebit
refund(amount, { game: "limbo", roundId: `n${ar.nonce}` });
```

### 2. Refund timing — not in sync `hydrate`

`createGameStore.hydrate` runs before auth/Supabase session. **Do not** call real RPC inside sync migrate.

**Pattern:**

1. **migrate (sync):** detect legacy `activeRounds` → set `pendingLegacyRefunds: { amount, nonce }[]` + fold to single-slot shape (`activeRound = null`)
2. **LimboScreen mount effect (once):** for each pending entry → `void refund(...).catch()` → clear `pendingLegacyRefunds`

This matches Crash unmount fire-and-forget; idempotency on server covers retries.

---

## Files

### 변경

1. **`src/shared/games/shell/createGameStore.ts`**
   - Optional `migrate?: (parsed: unknown, initial: T) => T` on factory (default: `{ ...initial, ...parsed }` only)
   - limbo v2 only — other games unchanged

2. **`src/shared/games/state/persistedGameState.ts`**
   - `LimboPersisted`: remove `activeRounds`, `lastOutcomeBySlot`, `activeSlot`
   - Add `activeRound: ActiveLimboRound | null`
   - Add `pendingLegacyRefunds?: { amount: number; nonce: number }[]` (strip after mount flush)
   - `ActiveLimboRound`: remove `slot` field
   - `limboStore` → version **2**, migrate:
     - If `parsed.activeRounds` is tuple → push each non-null `{ amount, nonce }` to `pendingLegacyRefunds`
     - `lastOutcome = parsed.lastOutcomeBySlot?.find(Boolean) ?? parsed.lastOutcome ?? null`
     - `activeRound = null` (never carry dual active into v2)
     - Drop legacy keys

3. **`src/features/games/limbo/LimboScreen.tsx`**
   - Remove `LimboMultiSlot`, dual `useGameRound`, `activeSlot` toggle
   - Single `LimboDisplay` + single `StakeBetPanel` (Dice/Wheel/Crash pattern)
   - Single `useGameRound`
   - Mount effect: drain `pendingLegacyRefunds` via `refund` + meta
   - PF applySeed: clear `activeRound` only (full refund RPC = **L-2 PR2**)

### 삭제

4. **`src/features/games/limbo/LimboMultiSlot.tsx`**

### Tests (rewrite + new)

5. **`limboStore.persist.spec.ts`** — v2 single-slot fields
6. **`limboStore.restore.spec.ts`** — single `activeRound` lifecycle
7. **`limboStore.migrate.spec.ts`** (new)
   - Both slots active → `pendingLegacyRefunds.length === 2`, `activeRound === null`
   - Slot 0 only → `pendingLegacyRefunds.length === 1`
   - v2 shape → no migrate mutation

---

## Acceptance

| AC | Description |
|----|-------------|
| AC-pre-1 | `LimboPersisted` has no `activeRounds` / `lastOutcomeBySlot` / `activeSlot` |
| AC-pre-2 | Legacy v1 hydrate → `pendingLegacyRefunds` populated; mount drains with `roundId: n${nonce}` |
| AC-pre-3 | `LimboScreen` single panel; real/demo mode isolated (Crash pattern) |
| AC-pre-4 | `LimboMultiSlot.tsx` deleted; zero imports |
| AC-pre-5 | `bun run check` GREEN |
| AC-pre-6 | migrate + persist + restore specs pass |

---

## Manual QA

1. Inject `phonara.gamestate.limbo.v1` with both slots active (legacy shape)
2. Load `/games/limbo` → single panel; after mount, balances reflect refunds (demo immediate; real after RPC)
3. New place → settle OK
4. PF seed change → nonce 0, `activeRound = null`
5. real ↔ demo toggle → no stale round UI

---

## Non-goals (L-2 PR2)

- `useUnmountRefund` hook
- StakeBetPanel integer clamp
- Dice/Wheel PF block
- Crash/Mines/Limbo PF refund with meta (except legacy pending drain)

---

## Workflow

```text
L-2-pre (Lovable) → review → merge
   ↓
L-2 PR2 (Lovable) — 5-game cancel matrix
   ↓
L-3 (hold 350ms)
```

---

## Risk notes

- **pendingLegacyRefunds + mount drain:** network fail on real → idempotent retry on reload; orphan reconciliation deferred L-3+
- **v1 → v2 key change:** old `limbo.v1` remains in localStorage until overwritten; migrate reads v1 once if v2 empty (optional one-time v1 read in migrate — document in code)

---

## Gate

- [ ] `bun run check` GREEN
- [ ] supabase / lib/api / types **0-diff**
- [ ] Merge before starting L-2 PR2

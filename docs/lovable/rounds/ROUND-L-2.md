# ROUND L-2 — Real Money Mid-Round Cancel

**Status:** PR1 **merged** · PR2 Lovable — **after L-2-pre** (Limbo single-slot)  
**Locked:** Path B · `refunded_at` · 2-PR sequential · **Limbo 1-slot** (not 2-slot)

---

## Goal

real 모드에서 mid-round cancel(PF apply / unmount) 시 PHON이 Supabase RPC로 반환되고, integer PHON과 UI 소수 입력 불일치가 exploit/과청구로 이어지지 않게 한다.

---

## Locked decisions

| Item | Choice |
|------|--------|
| Money path | **Path B** — `refund_phon_for_bet_v2` (no `credit_phon_for_payout_v2` hotfix) |
| Audit column | `game_rounds.refunded_at timestamptz NULL` |
| PR order | **Cursor PR1 → merge → Lovable PR2** |
| Dice/Wheel PF | Block while active (no refund RPC) |
| Crash/Mines/Limbo | Refund via RPC + `{ game, roundId }` (same roundId as debit) |
| Limbo slots | **1 slot** — Crash/Mines 동형 (`activeRound \| null`). 2-slot / `Promise.all` **폐기** |

---

## L-2-pre — Limbo single-slot revert (Lovable, **before** L-2 PR2)

**Why separate:** L-2 PR2 = 5-game cancel + StakeBetPanel (~3–4h). Limbo 구조 환원을 섞으면 diff·sanitation 추적이 어렵다.

### Scope

| Item | Action |
|------|--------|
| `LimboMultiSlot.tsx` | 삭제 |
| `LimboScreen.tsx` | 단일 `StakeBetPanel` + Crash/Wheel 동형 |
| `persistedGameState.ts` | `activeRound: ActiveLimboRound \| null` (drop `activeRounds`, `activeSlot`, `lastOutcomeBySlot`) |
| Store version | bump + **legacy migrate** (see below) |
| Specs | `limboStore.*.spec.ts` 단일 슬롯 시나리오로 재작성 |

### Legacy 2-slot localStorage migrate (**money-safe — mandatory**)

On hydrate/migrate when old shape has `activeRounds`:

1. For **each** non-null slot → `void refund(amount, { game: 'limbo', roundId: \`n${nonce}\` })` (real) before clearing
2. Fold state: prefer `activeRounds[0]` for `activeRound`; if `[1]` also active, refund `[1]` then discard (never silent forfeit)
3. Drop multi-slot fields after migrate

**Owner:** Lovable (store + screen). Real RPC already on `main` (PR1).

### L-2-pre gate

- [ ] `bun run check` GREEN
- [ ] No supabase / lib/api / types edits
- [ ] Dual-slot UI gone; single panel only

---

## PR1 — Cursor (`cursor/l-2-refund-rpc`)

### Files

| 구분 | 경로 |
| ---- | ---- |
| 신규 | `supabase/migrations/*_refund_phon_for_bet_v2.sql` |
| 수정 | `src/lib/api/wallet.ts`, `walletSchemas.ts` |
| 수정 | `src/shared/wallet/useGameWallet.ts` |
| 수정 | `src/integrations/supabase/types.ts` |
| 신규 | `src/lib/api/__tests__/walletRefund.spec.ts` |
| 수정 | `src/lib/api/__tests__/walletSchemas.spec.ts` |
| 신규 | `docs/CURSOR_AUDIT_NOTES.md` |

### Non-touch (PR1)

- [x] `src/features/games/**` Screen 0-diff
- [x] `StakeBetPanel` 0-diff

### Gate

- [x] Migration applied + advisors (phonara-gb · `refund_phon_for_bet_v2`)
- [x] types.ts includes `refunded_at` + `refund_phon_for_bet_v2`
- [x] `bun run check` GREEN (130 tests)
- [x] **Do not touch** game Screens in PR1 (Lovable owns call sites)

---

## PR2 — Lovable (`lovable/l-2-cancel-paths`)

**Prerequisite:** PR1 on `main` · **L-2-pre merged** · read [`docs/CURSOR_AUDIT_NOTES.md`](../../CURSOR_AUDIT_NOTES.md)

**Budget:** ~3–4h (StakeBetPanel mode clamp **1–2h**)

### Files

| 구분 | 경로 |
| ---- | ---- |
| 수정 | `CrashScreen.tsx` — refund meta + timer registry |
| 수정 | `MinesScreen.tsx` — PF refund + unmount |
| 수정 | `LimboScreen.tsx` — PF + unmount refund (single `activeRound`) |
| 수정 | `DiceScreen.tsx`, `WheelScreen.tsx` — PF block |
| 수정 | `StakeBetPanel.tsx` — `useMode()` int clamp (real) |
| 신규 | `src/shared/wallet/useUnmountRefund.ts` + spec |
| 수정 | `crashStore.restore.spec.ts` |

### Cancel matrix

| Game | PF applySeed | unmount |
|------|--------------|---------|
| Crash | refund if unsettled | refund if unsettled |
| Mines | refund if activeRound | refund if activeRound |
| Limbo | refund if `activeRound` | refund if `activeRound` |
| Wheel | **block** if active/rolling | — |
| Dice | **block** if activeBet / not idle | — |

### Gate

- [ ] `bun run check` GREEN
- [ ] supabase / lib/api / types 0-diff

---

## Acceptance criteria

| AC | Description |
|----|-------------|
| AC-1 | debit `n5` → refund `n5` → `game_rounds.refunded_at IS NOT NULL` |
| AC-2 | double refund same roundId → idempotent, +stake once |
| AC-3 | real `tryDebit(0.49)` → false; StakeBetPanel real blocks &lt;1 / non-integer |
| AC-4 | Crash PF betting → 1 refund RPC `{ game: 'crash', roundId }` |
| AC-5 | Mines unmount mid-round → 1 refund RPC |
| AC-6 | Limbo active round PF → 1 refund RPC |
| AC-7 | Dice/Wheel PF while active → blocked + toast, no RPC |
| AC-8 | `credit_phon_for_payout_v2` on refunded round → rejected |
| Gate | `bun run check` GREEN both PRs |

---

## Unmount pattern (PR2)

```ts
void refund(amount, { game, roundId }).catch(() => undefined);
```

Extract `useUnmountRefund` — **Crash + Mines + Limbo** SSOT.

---

## Manual QA

### PR1 gap window (known)

real refund without meta → local cache only (legacy). QA after **PR2 merge** for full real cancel.

### PR2 complete

- [ ] Crash PF mid-betting → balance restored (real)
- [ ] Crash navigate away mid-round → refund
- [ ] Mines PF + unmount
- [ ] Limbo single-slot PF + unmount
- [ ] Dice/Wheel PF blocked during roll
- [ ] StakeBetPanel: real int only, demo decimal OK
- [ ] Demo regression: 5 games one round each

---

## Non-goals

- Path A hotfix
- hold 350ms (L-3)
- Mines 812 refactor (N)
- Plinko (M)
- orphan debit reconciliation job

---

## Next

- **L-3:** hold-to-confirm 350ms + haptic
- **M:** Plinko
- **N:** Mines ≤400 refactor

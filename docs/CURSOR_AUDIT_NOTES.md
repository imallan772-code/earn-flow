# Cursor Audit Notes — Lovable gate

Lovable: **매 라운드 시작 시 본 문서를 읽고 `blocking = Yes` 행을 plan에 반영하라.**

전수 덤프 금지 — 아래 테이블만 SSOT.

## ROUND L-1 audit (2026-06-06)

| ID | severity | owner | blocking next round | summary | suggested AC |
|----|----------|-------|---------------------|---------|--------------|
| L1-A | P0 | Cursor | No | real refund RPC missing | AC-1, AC-2, AC-8 |
| L1-B | P0 | Lovable | No | Mines/Limbo PF+unmount refund; Crash meta | AC-4, AC-5, AC-6 |
| L1-C | P0 | Cursor+Lovable | No | integer-only real + StakeBetPanel clamp | AC-3 |
| L1-D | P1 | Lovable | No (L-3) | hold 150ms too short | — |
| L1-E | P2 | Lovable | No | HistoryPillStrip Dice "x" meaning bug | — |
| L2-pre | P1 | Lovable | No | Limbo revert to **1 slot**; legacy 2-slot migrate + refund both | — |

## Resolved

| ID | status | note |
|----|--------|------|
| L1-A | **done** | `refund_phon_for_bet_v2` · `refundPhonForBet` · `useGameWallet.refund` async |
| L2-pre | **done** | `38add94` · limbo v2 single-slot · legacy drain |
| L1-B | **done** | `ee30ebd` · `useUnmountRefund` · Crash/Mines/Limbo PF+unmount meta refund |
| L1-C | **done** | `ee30ebd` · StakeBetPanel real integer clamp (min=1, step=1, floor) |
| L1-D | **done** | `458b008` · Crash `HOLD_CONFIRM_MS=350` + gameRules sync |
| L1-E | **done** | `458b008` · HistoryPillStrip `displayMode="value"` · Dice pill no `x` |

## Workflow order (2026-06-06)

1. ~~L-2 PR1 (Cursor)~~ **done**
2. ~~L-2-pre (Lovable)~~ **done**
3. ~~L-2 PR2 (Lovable)~~ **done** — Cursor sanitation `ee30ebd` GREEN
4. ~~ROUND M Plinko (Lovable)~~ **done** — `d062e1e` · Cursor sanitation + live feed settle
5. ~~L-3 + L1-E (Lovable)~~ **done** — `458b008` · Cursor sanitation GREEN

## PR1–PR2 gap

**Closed** at L-2 PR2 merge. Crash/Mines/Limbo call sites now pass `{ game, roundId }` meta.

## Next (non-blocking)

- **ROUND N:** Mines Display/Controls 분리 (v2.1)
- Orphan debit reconciliation job (deferred)

## 차례 SSOT

→ **[`docs/WHOSE-TURN.md`](../WHOSE-TURN.md)** — 지금 누구 차례인지 한 줄로 확인

## Stake/Rollbit 압살 (M scope 밖)

→ [`docs/backlog/rounds/GAMES-ROADMAP-v2.2-v2.3.md`](../backlog/rounds/GAMES-ROADMAP-v2.2-v2.3.md)

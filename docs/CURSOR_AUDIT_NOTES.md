# Cursor Audit Notes — Lovable gate

Lovable: **매 라운드 시작 시 본 문서를 읽고 `blocking = Yes` 행을 plan에 반영하라.**

전수 덤프 금지 — 아래 테이블만 SSOT.

## ROUND L-1 audit (2026-06-06)

| ID | severity | owner | blocking next round | summary | suggested AC |
|----|----------|-------|---------------------|---------|--------------|
| L1-A | P0 | Cursor | Yes (L-2 PR1) | real refund RPC missing | AC-1, AC-2, AC-8 |
| L1-B | P0 | Lovable | Yes (L-2 PR2) | Mines/Limbo PF+unmount refund; Crash meta | AC-4, AC-5, AC-6 |
| L1-C | P0 | Cursor+Lovable | Yes (L-2) | integer-only real + StakeBetPanel clamp | AC-3 |
| L1-D | P1 | Lovable | No (L-3) | hold 150ms too short | — |
| L1-E | P2 | Lovable | No | HistoryPillStrip Dice "x" meaning bug | — |
| **L2-pre** | P1 | Lovable | **Yes (before L-2 PR2)** | Limbo revert to **1 slot**; legacy 2-slot migrate + refund both | — |

## Resolved (L-2 PR1 — Cursor)

| ID | status | note |
|----|--------|------|
| L1-A | **done** | remote migration applied · `refundPhonForBet` + `useGameWallet.refund` async |

## Workflow order (2026-06-06)

1. ~~L-2 PR1 (Cursor)~~ **done**
2. **L-2-pre** — Limbo 1-slot revert + legacy migrate (Lovable)
3. **L-2 PR2** — 5-game cancel + StakeBetPanel (Lovable)

## PR1–PR2 gap (intentional)

PR1 merge ~ PR2 merge: real `refund()` without `{ game, roundId }` meta keeps legacy local cache bump (pre-L-2 bug, not worsened). Minimize gap — start Lovable PR2 same day as PR1 merge.

# ADR: Mines Auto-Bet Reveal Strategy

**Date**: 2026-06-08  
**Status**: Accepted  
**Scope**: GA-J2c Mines server auto-bet — `auto_bet_mines_strategy_v1`

## Context

Server auto-bet worker needs to autonomously reveal tiles in Mines without client input. Four strategies were evaluated.

## Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| (a) Fixed indices | Always reveal same tile positions (e.g. 0,5,10,15,20) | **Rejected** — pattern analysis enables abuse |
| **(b) PF float order** | Use `pf_draw_float` cursor to deterministically order tiles per (server_seed, client_seed, nonce) | **Accepted** |
| (c) User pattern replay | Remember first manual round's pattern, auto-repeat | **Rejected** — Phase 2 scope creep, complex |
| (d) Random | Server-side random without PF | **Rejected** — RNG location ambiguous, not externally verifiable |

## Decision

**(b) PF float deterministic order.** Same (seed, nonce) always produces the same reveal sequence. Externally verifiable. Consistent with all other game PF implementations.

## Function Signature

```sql
CREATE OR REPLACE FUNCTION public.auto_bet_mines_strategy_v1(
  p_round_id text,
  p_reveal_index int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
```

### Internal Lookups (caller does NOT pass state)

1. `game_active_sessions` WHERE `round_id = p_round_id` AND `status = 'active'` → `client_state->'revealed'`, `server_seed`, `client_seed`, `nonce`, `mine_count`
2. `game_session_secrets.mines` (int[]) — layout from `mines_generate_layout`

### Algorithm

```
cursor = 0
FOR i IN 0..p_reveal_index:
  tile := pf_ordered_tile_index(server_seed, client_seed, nonce, cursor)
  cursor++ until tile NOT IN already_revealed AND NOT mine
END LOOP
```

### Return Values

| status | When |
|--------|------|
| `reveal` | Safe tile found → `{ tile_index, payload_for_reveal_rpc }` |
| `mine_hit` | Tile is mine → `{ tile_index, profit: -bet_amount }` |
| `cashout_ready` | `reveal_index == reveal_count - 1` and safe → `{ revealed_count, suggested_action: "cashout" }` |
| `invalid` | `reveal_index > 25 - mine_count` → `{ reason: "reveal_index_exceeds_safe_cap" }` |

## Safety Guards

- `reveal_count <= 25 - mine_count` enforced at `auto_bet_create_v1` (reject `MINES_REVEAL_COUNT_INVALID`)
- Mine hit → immediate loss settlement, next tick starts new round
- Idempotent: same `(round_id, reveal_index)` → same result

## Consequences

- All 6 games maintain PF integrity for auto-bet
- External verifier can reproduce Mines auto-bet sequence
- `game_phase` extended: `'mines_revealing'`, `'mines_cashout_pending'`

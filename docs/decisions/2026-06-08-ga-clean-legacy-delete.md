# ADR: GA-CLEAN — Legacy Client Outcome Fallback Deletion

**Date**: 2026-06-08  
**Status**: Accepted  
**Scope**: GA-CLEAN PR — Acceptance Gate #1 compliance

## Context

Plan v3 §11 Gate #1 requires:

> 6게임 클라 outcome 계산 grep 0건 (real+demo 모두 Edge 경유)

Currently, game screens (`DiceScreen`, `LimboScreen`, `CrashScreen`, etc.) contain legacy fallback paths that call client-side `computeRoll` / `computeCrashPoint` when the server authority feature flag is off.

## Options Considered

| # | Option | Risk |
|---|--------|------|
| **1** | **Delete legacy fallback code entirely** | Requires offline dev to use mock, but eliminates attack surface |
| 2 | Add `if (!flag && isProduction) throw` runtime assertion | Dead code remains; someone might remove the assertion |
| 3 | Isolate fallback to demo-only + grep CI gate | Still has client RNG code in production bundle |

## Decision

**Option #1: Delete legacy fallback code.** This is the only option that satisfies Gate #1 literally (grep 0 for client outcome computation).

- Offline/local development: use mock service or local Supabase with flags enabled
- `computeRoll`, `computeCrashPoint`, and similar client-side outcome functions remain in engine files for unit tests and PF verification scripts only — they are NOT called from game screens

## Implementation Scope

Files to modify:
- `src/features/games/dice/DiceScreen.tsx` — remove `computeRoll` import and fallback branch
- `src/features/games/limbo/LimboScreen.tsx` — remove `computeCrashPoint` fallback
- `src/features/games/crash/CrashScreen.tsx` — remove `computeCrashPoint` fallback
- `src/features/games/wheel/WheelScreen.tsx` — if any client outcome path exists
- `src/features/games/plinko/PlinkoScreen.tsx` — if any client outcome path exists
- `src/features/games/mines/MinesScreen.tsx` — if any client outcome path exists

## Verification

```bash
rg "computeRoll|computeCrashPoint|computeWheelSpin" src/features/games/ --type ts --type tsx
# Expected: 0 matches in Screen files (engine files OK)
```

## Consequences

- Gate #1 becomes objectively PASS
- No risk of accidental client-side outcome activation via flag misconfiguration
- Engine test files retain functions for vitest/parity specs (no change)

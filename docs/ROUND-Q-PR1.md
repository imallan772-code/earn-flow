# ROUND Q-PR1 — Provably Fair Verify Page

**Goal:** Public `/fair/verify` — SHA256 commit + outcome re-derivation (Stake 1:1).

---

## Part split

| Part | Scope | Files | Status |
|------|-------|-------|--------|
| **Q-a** | Pure verify lib + Zod + vitest | `src/lib/pf/*` | ✅ |
| **Q-b** | Public route + UI + SEO meta + share URL | `src/routes/fair.verify.tsx`, `FairVerifyScreen` | ✅ |
| **Q-c** | Lovable polish (optional) | Modal → link CTA, game-specific copy | Lovable |
| **Q-d** | Plinko WASM precompute (heavy) | Worker / Edge | Phase 3 |

---

## Supported games

| Game | Extra params | Engine |
|------|--------------|--------|
| Crash | — | `CrashEngine.computeCrashPoint` |
| Dice | — | `DiceEngine.computeRoll` |
| Limbo | — | `LimboEngine.computeCrashPoint` |
| Wheel | `risk`, `segments` | `WheelEngine.spin` + `getSegments` |
| Mines | `mineCount` | `MinesEngine.placeMines` |

---

## Share link format

```text
/fair/verify?game=crash&serverSeed=...&clientSeed=...&nonce=0&hash=<sha256>
```

---

## Verification

```bash
bun run check
# Manual: open /fair/verify with crash seeds from crashEngine.spec.ts
```

---

## Non-touch (Lovable)

- `supabase/`, `lib/api/`, money paths
- Engine math (`shared/games/*Engine.ts`)

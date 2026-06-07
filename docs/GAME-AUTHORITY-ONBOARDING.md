# Game Authority Onboarding

> SSOT plan: [`PHONARA-GAME-AUTHORITY-PLAN-v3-FINAL.md`](./PHONARA-GAME-AUTHORITY-PLAN-v3-FINAL.md)

## Locked Rules (execution)

- **No git commit/push** until full plan complete + explicit user approval.
- **Do not modify**: autobot (`botGenerator`), live feed (`LiveBetsFeed`, `liveTickScheduler`, `live_bets` triggers).
- **Supabase**: one migration per GA, no duplicate RPC names, forward-only SQL.
- **Auto-continue** all GA items without mid-plan approval gates.

## Architecture (W1 complete path)

```
Client → pf_session_create_or_get_v1 → pf_sessions (per user+game)
Client → resolve_user_mode_v1 → demo|real (anon always demo)
Client → usePfSession hook → 5 instant games + Mines (legacy fallback offline)
Edge _shared/ → pf.ts, modeResolver.ts, money.ts (GA-E+ template)
```

## PR Order

| PR | Scope | Gate |
|---|---|---|
| GA-0 | Resume-first, refund guard | vitest |
| GA-B | RTP 1.00 demo/real | check |
| GA-C | Plinko honest PF UI | check |
| GA-D | mines_cashout_v2 | check |
| Hotfix | Dice bettingRoundKey, numberOfBets | check |
| GA-A | pf_sessions + user_settings + usePfSession | check |
| GA-E | Crash server authority (template) | check + latency report |
| GA-F~I | Dice/Limbo/Wheel/Plinko server authority | check each |
| GA-J | Server auto-bet worker | load 4,500 sessions |
| GA-K | micro-PHON + reconciliation | 22,500 sessions |

## Key Files

| Area | Path |
|---|---|
| PF hook | `src/shared/games/hooks/usePfSession.ts` |
| PF API | `src/lib/api/pfSession.ts` |
| Mode resolver | `src/shared/mode/resolveMode.ts` |
| GA-A migration | `supabase/migrations/20260608130000_ga_a_pf_sessions_user_settings.sql` |
| Edge shared | `supabase/functions/_shared/` |
| Loss cap ADR | `docs/decisions/2026-06-08-no-default-loss-cap.md` |

## Deploy Checklist (post-approval)

1. `supabase db push` — apply migrations in order
2. Enable **Anonymous sign-in** in Supabase Auth (GA-A)
3. Deploy Edge functions when GA-E lands
4. Run `bun run check` + `test:e2e:public`

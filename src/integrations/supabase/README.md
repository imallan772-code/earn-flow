# Supabase integration

Connected project: **phonara-gb** (`https://kanftnqenuzverroodev.supabase.co`)

## Setup

1. Copy `.env.example` → `.env`
2. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase dashboard
3. `bun run dev`

## Modules

| File | Role |
|------|------|
| `client.ts` | Browser Supabase client (auth session in localStorage) |
| `env.ts` | Public env validation |
| `types.ts` | Generated DB types |

## App wiring

- `AuthProvider` / `useAuth` — session + profile
- `useProfile` — balances + onboarding RPC
- `useGameWallet` — demo localStorage + real Supabase PHON sync
- `RequireAuth` — protects `/_app/*` routes

## Database

- `profiles` — nickname, referral, VIP, onboarding state (RLS: own row)
- `wallet_balances` — PHON / USDT / KRW (RLS: own row)
- `complete_onboarding_step` RPC — server-authoritative onboarding rewards (1000+500+200+100 PHON)

Migrations live in `supabase/migrations/`.

# Supabase integration

Connected project: **phonara-gb** (`https://kanftnqenuzverroodev.supabase.co`)

## Setup

1. Copy `.env.example` → `.env`
2. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase dashboard
3. Push auth config (URL, passkeys, email autoconfirm for dev):

   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:config:push
   ```

   Or after `supabase login`: `bun run supabase:config:push`

4. `bun run dev` → http://localhost:8080

## Auth features (client)

| Method                                 | Status                                       |
| -------------------------------------- | -------------------------------------------- |
| Email / password                       | Live                                         |
| Passkey sign-in + profile registration | Live (Dashboard Passkeys must be enabled)    |
| Google OAuth                           | Client ready — enable provider + push config |
| Phone OTP                              | UI placeholder                               |

Passkeys require `@supabase/supabase-js` ≥ 2.105 and `experimental.passkey` in `client.ts`.

## Modules

| File        | Role                                                   |
| ----------- | ------------------------------------------------------ |
| `client.ts` | Browser Supabase client (auth session in localStorage) |
| `env.ts`    | Public env validation                                  |
| `types.ts`  | Generated DB types                                     |

## App wiring

- `AuthProvider` / `useAuth` — session + profile + passkey/OAuth helpers
- `PasskeySettings` — register / list / delete passkeys (profile)
- `useProfile` — balances + onboarding RPC
- `useGameWallet` — demo localStorage + real Supabase PHON sync
- `RequireAuth` — protects `/_app/*` routes

## Database

- `profiles` — nickname, referral, VIP, onboarding state (RLS: own row)
- `wallet_balances` — PHON / USDT / KRW (RLS: own row)
- `complete_onboarding_step` RPC — server-authoritative onboarding rewards (5000+2500+1500+1000 = 10,000 PHON)

Migrations live in `supabase/migrations/`. Auth URL + passkey RP settings live in `supabase/config.toml`.

-- PHONARA initial schema (applied to kanftnqenuzverroodev)

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  referral_code text UNIQUE NOT NULL,
  vip_tier text NOT NULL DEFAULT 'Bronze',
  vip_progress numeric(5,4) NOT NULL DEFAULT 0 CHECK (vip_progress >= 0 AND vip_progress <= 1),
  streak_days integer NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step integer NOT NULL DEFAULT 0 CHECK (onboarding_step >= 0 AND onboarding_step <= 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phon bigint NOT NULL DEFAULT 0 CHECK (phon >= 0),
  usdt numeric(18,6) NOT NULL DEFAULT 0 CHECK (usdt >= 0),
  krw bigint NOT NULL DEFAULT 0 CHECK (krw >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

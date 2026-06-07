-- =============================================================================
-- P-PR1: Public live bet feed — synced from real-mode game_rounds (additive Realtime)
-- Demo/bot FOMO stays client-side; only real RPC bets mirror here.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.live_bets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key     text NOT NULL UNIQUE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  game          text NOT NULL,
  amount        bigint NOT NULL CHECK (amount >= 0),
  multiplier    numeric(12, 4),
  profit        bigint,
  status        text NOT NULL CHECK (status IN ('pending', 'cashout', 'bust', 'win', 'loss')),
  mode          text NOT NULL DEFAULT 'real' CHECK (mode IN ('demo', 'real')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_bets_created_at
  ON public.live_bets (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_bets_game_created
  ON public.live_bets (game, created_at DESC);

ALTER TABLE public.live_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_bets_select_public ON public.live_bets;
CREATE POLICY live_bets_select_public ON public.live_bets
  FOR SELECT TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.live_bets FROM anon, authenticated;

-- Masked display handle — never expose raw user_id in feed UI
CREATE OR REPLACE FUNCTION public.live_bet_mask_display(p_user_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'Player_' || upper(substr(md5(p_user_id::text), 1, 6));
$$;

CREATE OR REPLACE FUNCTION public.sync_live_bet_from_game_round()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key      text;
  v_display  text;
  v_status   text;
  v_mult     numeric(12, 4);
  v_profit   bigint;
BEGIN
  v_key := NEW.game || ':' || NEW.round_id;
  v_display := public.live_bet_mask_display(NEW.user_id);

  IF NEW.refunded_at IS NOT NULL THEN
    v_status := CASE WHEN NEW.game = 'crash' THEN 'bust' ELSE 'loss' END;
    v_profit := -NEW.bet_amount;
    v_mult := NULL;
  ELSIF NEW.payout_amount = 0 THEN
    v_status := 'pending';
    v_profit := NULL;
    v_mult := NULL;
  ELSIF NEW.payout_amount > NEW.bet_amount THEN
    v_mult := round((NEW.payout_amount::numeric / NULLIF(NEW.bet_amount, 0)), 4);
    v_profit := NEW.payout_amount - NEW.bet_amount;
    v_status := CASE WHEN NEW.game = 'crash' THEN 'cashout' ELSE 'win' END;
  ELSE
    v_profit := NEW.payout_amount - NEW.bet_amount;
    v_mult := CASE
      WHEN NEW.payout_amount > 0 AND NEW.bet_amount > 0
        THEN round((NEW.payout_amount::numeric / NEW.bet_amount), 4)
      ELSE NULL
    END;
    v_status := CASE WHEN NEW.game = 'crash' THEN 'bust' ELSE 'loss' END;
  END IF;

  INSERT INTO public.live_bets (
    event_key, user_id, display_name, game, amount,
    multiplier, profit, status, mode, created_at, updated_at
  )
  VALUES (
    v_key, NEW.user_id, v_display, NEW.game, NEW.bet_amount,
    v_mult, v_profit, v_status, 'real', NEW.created_at, now()
  )
  ON CONFLICT (event_key) DO UPDATE SET
    amount = EXCLUDED.amount,
    multiplier = EXCLUDED.multiplier,
    profit = EXCLUDED.profit,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_live_bet_from_game_round ON public.game_rounds;
CREATE TRIGGER trg_sync_live_bet_from_game_round
  AFTER INSERT OR UPDATE OF bet_amount, payout_amount, refunded_at
  ON public.game_rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_live_bet_from_game_round();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_bets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_bets;
  END IF;
END $$;

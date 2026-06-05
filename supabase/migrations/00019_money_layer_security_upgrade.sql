-- =============================================================================
-- earn-flow Money Layer — Security Upgrade (SAFE / INCREMENTAL)
-- =============================================================================
-- Strategy:
--   • v1 RPCs (debit_phon_for_bet, credit_phon_for_payout) are NOT modified.
--   • v2 RPCs add idempotency + audit + stricter validation alongside v1.
--   • Client opts in via debit_phon_for_bet_v2 / credit_phon_for_payout_v2.
--   • All statements idempotent — safe to re-run.
--
-- Audit SSOT: game_rounds (bet_amount / payout_amount per round).
-- Idempotency cache: money_idempotency_ledger (replay only, not full audit_logs).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Supporting objects (additive only)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.money_idempotency_ledger (
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation       text        NOT NULL CHECK (operation IN (
                    'debit_phon_for_bet_v2',
                    'credit_phon_for_payout_v2'
                  )),
  idempotency_key text        NOT NULL,
  amount          bigint      NOT NULL CHECK (amount > 0),
  response        jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation, idempotency_key)
);

COMMENT ON TABLE public.money_idempotency_ledger IS
  'Idempotency replay cache for v2 money RPCs. Populated only by SECURITY DEFINER functions.';

CREATE INDEX IF NOT EXISTS idx_money_idempotency_user_created
  ON public.money_idempotency_ledger (user_id, created_at DESC);

-- game_rounds may pre-exist from 20260605200000; index is additive
CREATE INDEX IF NOT EXISTS idx_game_rounds_user_created
  ON public.game_rounds (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trading_positions_user_id
  ON public.trading_positions (user_id);

-- Shared validator (new object — does not alter v1 behaviour)
CREATE OR REPLACE FUNCTION public.money_validate_bet_input(
  p_amount bigint,
  p_game text,
  p_round_id text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'MONEY_INVALID_AMOUNT'
      USING ERRCODE = '22023', HINT = 'amount must be positive integer';
  END IF;
  IF p_game IS NULL OR length(trim(p_game)) = 0 OR length(p_game) > 32 THEN
    RAISE EXCEPTION 'MONEY_INVALID_GAME'
      USING ERRCODE = '22023', HINT = 'game length 1..32';
  END IF;
  IF p_round_id IS NULL OR length(trim(p_round_id)) = 0 OR length(p_round_id) > 128 THEN
    RAISE EXCEPTION 'MONEY_INVALID_ROUND_ID'
      USING ERRCODE = '22023', HINT = 'round_id length 1..128';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- B. v2 Atomic RPCs (NEW — v1 untouched)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.debit_phon_for_bet_v2(
  p_amount bigint,
  p_game text,
  p_round_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_game     text := trim(p_game);
  v_round    text := trim(p_round_id);
  v_key      text;
  v_cached   jsonb;
  v_cached_amt bigint;
  v_wal      public.wallet_balances%ROWTYPE;
  v_result   json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  v_key := v_game || ':' || v_round;

  -- Idempotency replay
  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid
    AND operation = 'debit_phon_for_bet_v2'
    AND idempotency_key = v_key;

  IF FOUND THEN
    IF v_cached_amt <> p_amount THEN
      RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN v_cached;
  END IF;

  -- Lock wallet (deadlock-safe ordering: wallet → game_rounds → ledger)
  SELECT * INTO v_wal FROM public.wallet_balances WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_WALLET_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wal.phon < p_amount THEN
    RAISE EXCEPTION 'MONEY_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  -- Audit: game_rounds (upsert — compatible with log_game_round)
  INSERT INTO public.game_rounds (user_id, game, round_id, bet_amount, payout_amount)
  VALUES (v_uid, v_game, v_round, p_amount, 0)
  ON CONFLICT (user_id, game, round_id) DO UPDATE
    SET bet_amount = EXCLUDED.bet_amount
  WHERE public.game_rounds.bet_amount = 0
     OR public.game_rounds.bet_amount = EXCLUDED.bet_amount;

  IF NOT FOUND THEN
    PERFORM 1 FROM public.game_rounds
    WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND bet_amount = p_amount;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.wallet_balances
  SET phon = phon - p_amount, updated_at = now()
  WHERE user_id = v_uid AND phon >= p_amount
  RETURNING * INTO v_wal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MONEY_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  v_result := json_build_object(
    'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
    'amount', p_amount, 'operation', 'debit_phon_for_bet_v2', 'idempotent', false, 'version', 2
  );

  INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
  VALUES (v_uid, 'debit_phon_for_bet_v2', v_key, p_amount, v_result);

  RETURN v_result;

EXCEPTION WHEN unique_violation THEN
  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid AND operation = 'debit_phon_for_bet_v2' AND idempotency_key = v_key;
  IF FOUND AND v_cached_amt = p_amount THEN RETURN v_cached; END IF;
  RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_phon_for_payout_v2(
  p_amount bigint,
  p_game text,
  p_round_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_game     text := trim(p_game);
  v_round    text := trim(p_round_id);
  v_key      text;
  v_cached   jsonb;
  v_cached_amt bigint;
  v_wal      public.wallet_balances%ROWTYPE;
  v_gr       public.game_rounds%ROWTYPE;
  v_result   json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  v_key := v_game || ':' || v_round;

  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid
    AND operation = 'credit_phon_for_payout_v2'
    AND idempotency_key = v_key;

  IF FOUND THEN
    IF v_cached_amt <> p_amount THEN
      RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN v_cached;
  END IF;

  SELECT * INTO v_wal FROM public.wallet_balances WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_WALLET_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_gr FROM public.game_rounds
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MONEY_ROUND_NOT_FOUND' USING ERRCODE = 'P0002',
      HINT = 'debit_phon_for_bet_v2 or log_game_round must run first';
  END IF;

  IF v_gr.payout_amount > 0 AND v_gr.payout_amount <> p_amount THEN
    RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
  END IF;

  IF v_gr.payout_amount = p_amount THEN
    v_result := json_build_object(
      'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
      'amount', p_amount, 'operation', 'credit_phon_for_payout_v2', 'idempotent', true, 'version', 2
    );
    INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
    VALUES (v_uid, 'credit_phon_for_payout_v2', v_key, p_amount, v_result)
    ON CONFLICT DO NOTHING;
    RETURN v_result;
  END IF;

  UPDATE public.wallet_balances
  SET phon = phon + p_amount, updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_wal;

  UPDATE public.game_rounds
  SET payout_amount = p_amount
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round;

  v_result := json_build_object(
    'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
    'amount', p_amount, 'operation', 'credit_phon_for_payout_v2', 'idempotent', false, 'version', 2
  );

  INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
  VALUES (v_uid, 'credit_phon_for_payout_v2', v_key, p_amount, v_result);

  RETURN v_result;

EXCEPTION WHEN unique_violation THEN
  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid AND operation = 'credit_phon_for_payout_v2' AND idempotency_key = v_key;
  IF FOUND AND v_cached_amt = p_amount THEN RETURN v_cached; END IF;
  RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
END;
$$;

GRANT EXECUTE ON FUNCTION public.money_validate_bet_input(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_phon_for_bet_v2(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_phon_for_payout_v2(bigint, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- C. RLS hardening (strengthen existing policies — idempotent)
-- -----------------------------------------------------------------------------
-- Uses (SELECT auth.uid()) for per-statement eval (Supabase perf recommendation).
-- REVOKE direct writes: money mutations only via SECURITY DEFINER RPCs.
-- (No FORCE RLS — avoids breaking SECURITY DEFINER signup trigger / service paths.)

-- wallet_balances (existing: wallet_select_own from 20260605120000)
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_select_own ON public.wallet_balances;
CREATE POLICY wallet_select_own ON public.wallet_balances
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.wallet_balances FROM authenticated, anon;
GRANT SELECT ON public.wallet_balances TO authenticated;

-- game_rounds (existing: game_rounds_select_own from 20260605200000)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_rounds'
  ) THEN
    EXECUTE 'ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS game_rounds_select_own ON public.game_rounds';
    EXECUTE $p$
      CREATE POLICY game_rounds_select_own ON public.game_rounds
        FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.game_rounds FROM authenticated, anon';
    EXECUTE 'GRANT SELECT ON public.game_rounds TO authenticated';
  END IF;
END $$;

-- trading_positions (from 20260605200000)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trading_positions'
  ) THEN
    EXECUTE 'ALTER TABLE public.trading_positions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS trading_positions_select_own ON public.trading_positions';
    EXECUTE $p$
      CREATE POLICY trading_positions_select_own ON public.trading_positions
        FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.trading_positions FROM authenticated, anon';
    EXECUTE 'GRANT SELECT ON public.trading_positions TO authenticated';
  END IF;
END $$;

-- trading_orders (consistency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trading_orders'
  ) THEN
    EXECUTE 'ALTER TABLE public.trading_orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS trading_orders_select_own ON public.trading_orders';
    EXECUTE $p$
      CREATE POLICY trading_orders_select_own ON public.trading_orders
        FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.trading_orders FROM authenticated, anon';
    EXECUTE 'GRANT SELECT ON public.trading_orders TO authenticated';
  END IF;
END $$;

-- money_idempotency_ledger (new)
ALTER TABLE public.money_idempotency_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_idempotency_select_own ON public.money_idempotency_ledger;
CREATE POLICY money_idempotency_select_own ON public.money_idempotency_ledger
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.money_idempotency_ledger FROM authenticated, anon;
GRANT SELECT ON public.money_idempotency_ledger TO authenticated;

-- =============================================================================
-- Rollout:
--   1. Apply this migration (v1 keeps working)
--   2. Set VITE_MONEY_RPC_V2=true in client when ready
--   3. After soak period, optionally make v2 functions wrap v1 names in new migration
-- =============================================================================

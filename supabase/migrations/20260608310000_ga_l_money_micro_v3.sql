-- GA-L: Money micro-PHON v3 — dual-ledger SSOT (phon + phon_micro invariant).
-- Games keep calling debit/credit v2; v2 dispatches to v3 when money_micro_v3 flag on.
-- Does NOT touch live_bets triggers or autobot paths.

-- ─── Constant ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.money_phon_micro_unit_v1()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 1000000::bigint; $$;

REVOKE ALL ON FUNCTION public.money_phon_micro_unit_v1() FROM PUBLIC, anon, authenticated;

-- ─── v3 debit (micro-first ledger) ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.debit_phon_for_bet_v3(
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
  v_micro    bigint := public.money_phon_micro_unit_v1();
  v_amt_micro bigint;
  v_result   json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  v_key := v_game || ':' || v_round;
  v_amt_micro := p_amount * v_micro;

  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid
    AND operation = 'debit_phon_for_bet_v3'
    AND idempotency_key = v_key;

  IF FOUND THEN
    IF v_cached_amt <> p_amount THEN
      RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN v_cached;
  END IF;

  SELECT * INTO v_wal FROM public.wallet_balances WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_WALLET_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_wal.phon_micro := COALESCE(v_wal.phon_micro, v_wal.phon * v_micro);

  IF v_wal.phon_micro < v_amt_micro OR v_wal.phon < p_amount THEN
    RAISE EXCEPTION 'MONEY_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

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
  SET
    phon_micro = COALESCE(phon_micro, phon * v_micro) - v_amt_micro,
    phon = (COALESCE(phon_micro, phon * v_micro) - v_amt_micro) / v_micro,
    updated_at = now()
  WHERE user_id = v_uid
    AND COALESCE(phon_micro, phon * v_micro) >= v_amt_micro
  RETURNING * INTO v_wal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MONEY_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  v_result := json_build_object(
    'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
    'amount', p_amount, 'amount_micro', v_amt_micro,
    'operation', 'debit_phon_for_bet_v3', 'idempotent', false, 'version', 3
  );

  INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
  VALUES (v_uid, 'debit_phon_for_bet_v3', v_key, p_amount, v_result);

  RETURN v_result;

EXCEPTION WHEN unique_violation THEN
  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid AND operation = 'debit_phon_for_bet_v3' AND idempotency_key = v_key;
  IF FOUND AND v_cached_amt = p_amount THEN RETURN v_cached; END IF;
  RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
END;
$$;

-- ─── v3 credit ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.credit_phon_for_payout_v3(
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
  v_micro    bigint := public.money_phon_micro_unit_v1();
  v_amt_micro bigint;
  v_result   json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, p_game, v_round);
  v_key := v_game || ':' || v_round;
  v_amt_micro := p_amount * v_micro;

  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid
    AND operation = 'credit_phon_for_payout_v3'
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
      HINT = 'debit_phon_for_bet_v3 or log_game_round must run first';
  END IF;

  IF v_gr.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'MONEY_ROUND_REFUNDED' USING ERRCODE = 'P0002';
  END IF;

  IF v_gr.payout_amount > 0 AND v_gr.payout_amount <> p_amount THEN
    RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
  END IF;

  IF v_gr.payout_amount = p_amount THEN
    v_result := json_build_object(
      'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
      'amount', p_amount, 'amount_micro', v_amt_micro,
      'operation', 'credit_phon_for_payout_v3', 'idempotent', true, 'version', 3
    );
    INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
    VALUES (v_uid, 'credit_phon_for_payout_v3', v_key, p_amount, v_result)
    ON CONFLICT DO NOTHING;
    RETURN v_result;
  END IF;

  UPDATE public.wallet_balances
  SET
    phon_micro = COALESCE(phon_micro, phon * v_micro) + v_amt_micro,
    phon = (COALESCE(phon_micro, phon * v_micro) + v_amt_micro) / v_micro,
    updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_wal;

  UPDATE public.game_rounds
  SET payout_amount = p_amount
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round;

  v_result := json_build_object(
    'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
    'amount', p_amount, 'amount_micro', v_amt_micro,
    'operation', 'credit_phon_for_payout_v3', 'idempotent', false, 'version', 3
  );

  INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
  VALUES (v_uid, 'credit_phon_for_payout_v3', v_key, p_amount, v_result);

  RETURN v_result;

EXCEPTION WHEN unique_violation THEN
  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid AND operation = 'credit_phon_for_payout_v3' AND idempotency_key = v_key;
  IF FOUND AND v_cached_amt = p_amount THEN RETURN v_cached; END IF;
  RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
END;
$$;

-- ─── v3 refund ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refund_phon_for_bet_v3(
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
  v_micro    bigint := public.money_phon_micro_unit_v1();
  v_amt_micro bigint;
  v_result   json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  v_key := v_game || ':' || v_round;
  v_amt_micro := p_amount * v_micro;

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'REFUND_ACTIVE_SESSION_DENIED' USING ERRCODE = 'P0002';
  END IF;

  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid
    AND operation = 'refund_phon_for_bet_v3'
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
    RAISE EXCEPTION 'MONEY_ROUND_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_gr.refunded_at IS NOT NULL THEN
    v_result := json_build_object(
      'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
      'amount', p_amount, 'operation', 'refund_phon_for_bet_v3', 'idempotent', true, 'version', 3
    );
    INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
    VALUES (v_uid, 'refund_phon_for_bet_v3', v_key, p_amount, v_result)
    ON CONFLICT DO NOTHING;
    RETURN v_result;
  END IF;

  IF v_gr.bet_amount <> p_amount OR v_gr.payout_amount > 0 THEN
    RAISE EXCEPTION 'MONEY_ROUND_ALREADY_SETTLED' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.wallet_balances
  SET
    phon_micro = COALESCE(phon_micro, phon * v_micro) + v_amt_micro,
    phon = (COALESCE(phon_micro, phon * v_micro) + v_amt_micro) / v_micro,
    updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_wal;

  UPDATE public.game_rounds SET refunded_at = now()
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round;

  v_result := json_build_object(
    'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
    'amount', p_amount, 'amount_micro', v_amt_micro,
    'operation', 'refund_phon_for_bet_v3', 'idempotent', false, 'version', 3
  );

  INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
  VALUES (v_uid, 'refund_phon_for_bet_v3', v_key, p_amount, v_result);

  RETURN v_result;
END;
$$;

-- ─── v2 dispatch → v3 when flag on; v2 path syncs phon_micro ─────────────────

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
  v_micro    bigint := public.money_phon_micro_unit_v1();
  v_result   json;
BEGIN
  IF public.game_authority_flag_v1('money_micro_v3') THEN
    RETURN public.debit_phon_for_bet_v3(p_amount, v_game, v_round);
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  v_key := v_game || ':' || v_round;

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

  SELECT * INTO v_wal FROM public.wallet_balances WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_WALLET_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_wal.phon < p_amount THEN
    RAISE EXCEPTION 'MONEY_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

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
  SET
    phon = phon - p_amount,
    phon_micro = (phon - p_amount) * v_micro,
    updated_at = now()
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
  v_micro    bigint := public.money_phon_micro_unit_v1();
  v_result   json;
BEGIN
  IF public.game_authority_flag_v1('money_micro_v3') THEN
    RETURN public.credit_phon_for_payout_v3(p_amount, v_game, v_round);
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, p_game, v_round);
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

  IF v_gr.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'MONEY_ROUND_REFUNDED' USING ERRCODE = 'P0002';
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
  SET
    phon = phon + p_amount,
    phon_micro = (phon + p_amount) * v_micro,
    updated_at = now()
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

-- refund v2 dispatch
CREATE OR REPLACE FUNCTION public.refund_phon_for_bet_v2(
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
  v_micro    bigint := public.money_phon_micro_unit_v1();
  v_result   json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  v_key := v_game || ':' || v_round;

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'REFUND_ACTIVE_SESSION_DENIED' USING ERRCODE = 'P0002';
  END IF;

  IF public.game_authority_flag_v1('money_micro_v3') THEN
    RETURN public.refund_phon_for_bet_v3(p_amount, v_game, v_round);
  END IF;

  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid
    AND operation = 'refund_phon_for_bet_v2'
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
      HINT = 'debit_phon_for_bet_v2 must run before refund';
  END IF;

  IF v_gr.refunded_at IS NOT NULL THEN
    SELECT * INTO v_wal FROM public.wallet_balances WHERE user_id = v_uid;
    v_result := json_build_object(
      'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
      'amount', p_amount, 'operation', 'refund_phon_for_bet_v2', 'idempotent', true, 'version', 2
    );
    INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
    VALUES (v_uid, 'refund_phon_for_bet_v2', v_key, p_amount, v_result)
    ON CONFLICT DO NOTHING;
    RETURN v_result;
  END IF;

  IF v_gr.bet_amount <> p_amount THEN
    RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505',
      HINT = 'refund amount must equal bet_amount';
  END IF;

  IF v_gr.payout_amount > 0 THEN
    RAISE EXCEPTION 'MONEY_ROUND_ALREADY_SETTLED' USING ERRCODE = 'P0002',
      HINT = 'payout already credited; refund not allowed';
  END IF;

  UPDATE public.wallet_balances
  SET
    phon = phon + p_amount,
    phon_micro = (phon + p_amount) * v_micro,
    updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_wal;

  UPDATE public.game_rounds SET refunded_at = now()
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round;

  v_result := json_build_object(
    'balance', row_to_json(v_wal), 'game', v_game, 'round_id', v_round,
    'amount', p_amount, 'operation', 'refund_phon_for_bet_v2', 'idempotent', false, 'version', 2
  );

  INSERT INTO public.money_idempotency_ledger (user_id, operation, idempotency_key, amount, response)
  VALUES (v_uid, 'refund_phon_for_bet_v2', v_key, p_amount, v_result);

  RETURN v_result;

EXCEPTION WHEN unique_violation THEN
  SELECT response, amount INTO v_cached, v_cached_amt
  FROM public.money_idempotency_ledger
  WHERE user_id = v_uid AND operation = 'refund_phon_for_bet_v2' AND idempotency_key = v_key;
  IF FOUND AND v_cached_amt = p_amount THEN RETURN v_cached; END IF;
  RAISE EXCEPTION 'MONEY_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
END;
$$;

-- ─── Wallet invariant probe (smoke / reconciliation) ─────────────────────────

CREATE OR REPLACE FUNCTION public.money_wallet_invariant_v1()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wal public.wallet_balances%ROWTYPE;
  v_micro bigint := public.money_phon_micro_unit_v1();
  v_expected bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_wal FROM public.wallet_balances WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONEY_WALLET_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_expected := v_wal.phon * v_micro;

  RETURN json_build_object(
    'phon', v_wal.phon,
    'phon_micro', COALESCE(v_wal.phon_micro, v_expected),
    'expected_micro', v_expected,
    'ok', COALESCE(v_wal.phon_micro, v_expected) = v_expected,
    'money_micro_v3', public.game_authority_flag_v1('money_micro_v3')
  );
END;
$$;

-- Backfill invariant for existing rows
UPDATE public.wallet_balances
SET phon_micro = phon * public.money_phon_micro_unit_v1()
WHERE phon_micro IS NULL OR phon_micro <> phon * public.money_phon_micro_unit_v1();

-- ─── Feature flag ────────────────────────────────────────────────────────────

INSERT INTO public.game_authority_flags (key, enabled, rollout_percent, description)
VALUES ('money_micro_v3', true, 100, 'GA-L micro-PHON money ledger (debit/credit v3)')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percent = EXCLUDED.rollout_percent,
  description = EXCLUDED.description,
  updated_at = now();

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.debit_phon_for_bet_v3(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_phon_for_payout_v3(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_phon_for_bet_v3(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.money_wallet_invariant_v1() TO authenticated;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.debit_phon_for_bet_v3(bigint,text,text)'::regprocedure,
    'public.credit_phon_for_payout_v3(bigint,text,text)'::regprocedure,
    'public.refund_phon_for_bet_v3(bigint,text,text)'::regprocedure,
    'public.money_wallet_invariant_v1()'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

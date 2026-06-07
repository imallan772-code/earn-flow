-- Fix credit_phon_for_payout_v3: references undefined 'p_round' instead of 'v_round'.
-- Parameter is p_round_id, local variable is v_round := trim(p_round_id).

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

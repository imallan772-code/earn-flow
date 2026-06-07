-- GA-0: Block client refund while an active game session exists (anti-abuse).
-- Resume-First SSOT — navigation/refresh must not refund mid-round stakes.

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
  v_result   json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  v_key := v_game || ':' || v_round;

  -- GA-0: active session for this round → refund denied (resume+settle instead).
  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid
      AND game = v_game
      AND round_id = v_round
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'REFUND_ACTIVE_SESSION_DENIED' USING ERRCODE = 'P0002',
      HINT = 'Resume active session and settle; mid-round refund is not allowed';
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
  SET phon = phon + p_amount, updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_wal;

  UPDATE public.game_rounds
  SET refunded_at = now()
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

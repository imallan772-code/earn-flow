-- Hotfix: pf_sessions has no updated_at column — remove from dice_place_v1 nonce increment.

CREATE OR REPLACE FUNCTION public.dice_place_v1(
  p_amount bigint,
  p_round_id text,
  p_target numeric,
  p_dice_mode text,
  p_client_seed text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'dice';
  v_round text := trim(p_round_id);
  v_mode text;
  v_pf json;
  v_session public.pf_sessions%ROWTYPE;
  v_used_nonce bigint;
  v_roll numeric;
  v_chance numeric;
  v_mult numeric;
  v_won boolean;
  v_debit json := NULL;
  v_credit json := NULL;
  v_gross bigint := 0;
  v_profit bigint := 0;
  v_sess public.game_active_sessions%ROWTYPE;
  v_existing public.game_active_sessions%ROWTYPE;
  v_state jsonb;
  v_dice_mode text := lower(trim(p_dice_mode));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF v_dice_mode NOT IN ('over', 'under') THEN RAISE EXCEPTION 'DICE_INVALID_MODE'; END IF;
  IF p_target IS NULL OR p_target < 1 OR p_target > 98 THEN RAISE EXCEPTION 'DICE_INVALID_TARGET'; END IF;

  SELECT * INTO v_existing FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game;

  IF FOUND AND v_existing.status = 'active' THEN
    IF v_existing.round_id = v_round THEN
      RETURN public.dice_sync_v1(v_round);
    END IF;
    RAISE EXCEPTION 'DICE_ACTIVE_SESSION' USING ERRCODE = '42501';
  END IF;

  v_mode := public.resolve_user_mode_v1();

  IF v_mode = 'real' THEN
    PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  END IF;

  v_pf := public.pf_session_create_or_get_v1(v_game, p_client_seed);
  SELECT * INTO v_session FROM public.pf_sessions WHERE id = (v_pf->>'id')::uuid FOR UPDATE;
  v_used_nonce := v_session.nonce;

  v_roll := public.dice_compute_roll(v_session.server_seed, v_session.client_seed, v_used_nonce);
  v_chance := public.dice_win_chance_pct(p_target, v_dice_mode);
  v_mult := public.dice_payout_multiplier(v_chance);
  v_won := public.dice_is_win(v_roll, p_target, v_dice_mode);

  IF v_mode = 'real' THEN
    v_debit := public.debit_phon_for_bet_v2(p_amount, v_game, v_round);
    IF v_won THEN
      v_gross := round(p_amount::numeric * v_mult)::bigint;
      IF v_gross >= 1 THEN
        v_credit := public.credit_phon_for_payout_v2(v_gross, v_game, v_round);
      END IF;
      v_profit := v_gross - p_amount;
    ELSE
      v_profit := -p_amount;
    END IF;
  END IF;

  UPDATE public.pf_sessions SET nonce = nonce + 1 WHERE id = v_session.id;

  v_state := jsonb_build_object(
    'nonce', v_used_nonce,
    'next_nonce', v_used_nonce + 1,
    'stake_amount', p_amount,
    'target', p_target,
    'dice_mode', v_dice_mode,
    'roll', v_roll,
    'won', v_won,
    'payout_multiplier', v_mult,
    'gross_payout', v_gross,
    'profit', v_profit,
    'bet_mode', v_mode,
    'pf_session_id', v_session.id,
    'animation_pending', true,
    'placed_at', (extract(epoch from now()) * 1000)::bigint
  );

  IF FOUND AND v_existing.status = 'settled' THEN
    UPDATE public.game_active_sessions
    SET
      round_id = v_round,
      bet_amount = CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
      client_state = v_state,
      status = 'active',
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_sess;
  ELSE
    INSERT INTO public.game_active_sessions (
      user_id, game, round_id, bet_amount, client_state, status
    ) VALUES (
      v_uid,
      v_game,
      v_round,
      CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
      v_state,
      'active'
    )
    RETURNING * INTO v_sess;
  END IF;

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'nonce', v_used_nonce,
    'next_nonce', v_used_nonce + 1,
    'roll', v_roll,
    'won', v_won,
    'payout_multiplier', v_mult,
    'gross_payout', v_gross,
    'profit', v_profit,
    'server_seed_hash', v_session.server_seed_hash,
    'debit', v_debit,
    'credit', v_credit,
    'session_id', v_sess.id
  );
END;
$$;

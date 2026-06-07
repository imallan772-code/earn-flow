-- Fix crash_cashout_v1 500 (CRASH_NOT_RUNNING) when client enters running before start_running.
-- Idempotent: auto-arm multiplier clock on cashout if betting phase never called start_running.

CREATE OR REPLACE FUNCTION public.crash_cashout_v1(
  p_round_id text,
  p_at_multiplier_e6 bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'crash';
  v_round text := trim(p_round_id);
  v_sess public.game_active_sessions%ROWTYPE;
  v_secret public.game_session_secrets%ROWTYPE;
  v_crash_e6 bigint;
  v_started bigint;
  v_elapsed bigint;
  v_max_mult_e6 bigint;
  v_mode text;
  v_bet bigint;
  v_mult_e6 bigint;
  v_gross bigint := 0;
  v_credit json := NULL;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF p_at_multiplier_e6 IS NULL OR p_at_multiplier_e6 < 1000000 THEN
    RAISE EXCEPTION 'CRASH_INVALID_MULTIPLIER';
  END IF;

  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'CRASH_SESSION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_secret FROM public.game_session_secrets WHERE session_id = v_sess.id;
  v_crash_e6 := v_secret.crash_point_e6;
  IF v_crash_e6 IS NULL THEN RAISE EXCEPTION 'CRASH_SECRET_MISSING'; END IF;

  IF (v_sess.client_state->>'cashed_at_e6') IS NOT NULL THEN
    RAISE EXCEPTION 'CRASH_ALREADY_CASHED';
  END IF;

  v_started := NULLIF((v_sess.client_state->>'started_at_ms')::bigint, 0);
  IF v_started IS NULL THEN
    v_started := (extract(epoch from now()) * 1000)::bigint;
    UPDATE public.game_active_sessions
    SET
      client_state = v_sess.client_state || jsonb_build_object('started_at_ms', v_started),
      updated_at = now()
    WHERE id = v_sess.id;
    v_sess.client_state := v_sess.client_state || jsonb_build_object('started_at_ms', v_started);
  END IF;

  v_elapsed := greatest(0, (extract(epoch from now()) * 1000)::bigint - v_started);
  v_max_mult_e6 := public.crash_multiplier_at_e6(v_elapsed);

  v_mult_e6 := least(p_at_multiplier_e6, v_max_mult_e6);

  IF v_mult_e6 >= v_crash_e6 THEN
    RAISE EXCEPTION 'CRASH_ALREADY_BUSTED';
  END IF;

  v_mode := COALESCE(v_sess.client_state->>'bet_mode', 'real');
  v_bet := v_sess.bet_amount;

  IF v_mode = 'real' AND v_bet > 0 THEN
    v_gross := round(v_bet::numeric * (v_mult_e6 / 1000000.0))::bigint;
    IF v_gross >= 1 THEN
      v_credit := public.credit_phon_for_payout_v2(v_gross, v_game, v_round);
    END IF;
  END IF;

  UPDATE public.game_active_sessions
  SET
    status = 'settled',
    client_state = v_sess.client_state || jsonb_build_object('cashed_at_e6', v_mult_e6),
    updated_at = now()
  WHERE id = v_sess.id;

  RETURN json_build_object(
    'round_id', v_round,
    'at_multiplier_e6', v_mult_e6,
    'crash_point_e6', v_crash_e6,
    'gross_payout', COALESCE(v_gross, 0),
    'credit', v_credit,
    'mode', v_mode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crash_cashout_v1(text, bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.crash_cashout_v1(text, bigint) FROM PUBLIC, anon;

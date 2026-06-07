-- Fix crash_place_v1: recycle settled session row (UNIQUE user_id+game).
-- Root cause: settle keeps row → INSERT violates unique constraint on next bet.

CREATE OR REPLACE FUNCTION public.crash_place_v1(
  p_amount bigint,
  p_round_id text,
  p_auto_target_e6 bigint DEFAULT NULL,
  p_client_seed text DEFAULT NULL
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
  v_mode text;
  v_pf json;
  v_session public.pf_sessions%ROWTYPE;
  v_crash_e6 bigint;
  v_debit json;
  v_sess public.game_active_sessions%ROWTYPE;
  v_existing public.game_active_sessions%ROWTYPE;
  v_state jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_existing FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game;

  IF FOUND AND v_existing.status = 'active' THEN
    IF v_existing.round_id = v_round THEN
      RETURN json_build_object(
        'round_id', v_existing.round_id,
        'mode', COALESCE(v_existing.client_state->>'bet_mode', 'real'),
        'server_seed_hash', NULL,
        'nonce', COALESCE((v_existing.client_state->>'nonce')::bigint, 0),
        'started_at_ms', NULLIF((v_existing.client_state->>'started_at_ms')::bigint, 0),
        'debit', NULL,
        'session_id', v_existing.id
      );
    END IF;
    RAISE EXCEPTION 'CRASH_ACTIVE_SESSION' USING ERRCODE = '42501';
  END IF;

  v_mode := public.resolve_user_mode_v1();

  IF v_mode = 'real' THEN
    PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  END IF;

  v_pf := public.pf_session_create_or_get_v1(v_game, p_client_seed);
  SELECT * INTO v_session FROM public.pf_sessions WHERE id = (v_pf->>'id')::uuid;

  v_crash_e6 := public.crash_compute_point_e6(
    v_session.server_seed,
    v_session.client_seed,
    v_session.nonce
  );

  IF v_mode = 'real' THEN
    v_debit := public.debit_phon_for_bet_v2(p_amount, v_game, v_round);
  END IF;

  v_state := jsonb_build_object(
    'nonce', v_session.nonce,
    'stake_amount', p_amount,
    'auto_target_e6', p_auto_target_e6,
    'cashed_at_e6', NULL,
    'started_at_ms', NULL,
    'bet_mode', v_mode,
    'pf_session_id', v_session.id
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

    DELETE FROM public.game_session_secrets WHERE session_id = v_sess.id;
    INSERT INTO public.game_session_secrets (session_id, mines, crash_point_e6)
    VALUES (v_sess.id, NULL, v_crash_e6);
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

    INSERT INTO public.game_session_secrets (session_id, mines, crash_point_e6)
    VALUES (v_sess.id, NULL, v_crash_e6);
  END IF;

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'server_seed_hash', v_session.server_seed_hash,
    'nonce', v_session.nonce,
    'started_at_ms', NULL,
    'debit', v_debit,
    'session_id', v_sess.id
  );
END;
$$;

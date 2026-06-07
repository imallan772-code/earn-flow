-- GA-E fix: started_at_ms must begin at running phase (not place time).
-- Adds crash_start_running_v1; demo skips integer bet validation; stores stake in client_state.

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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND game = v_game AND status = 'active'
  ) THEN
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

  INSERT INTO public.game_active_sessions (
    user_id, game, round_id, bet_amount, client_state, status
  ) VALUES (
    v_uid,
    v_game,
    v_round,
    CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
    jsonb_build_object(
      'nonce', v_session.nonce,
      'stake_amount', p_amount,
      'auto_target_e6', p_auto_target_e6,
      'cashed_at_e6', NULL,
      'started_at_ms', NULL,
      'bet_mode', v_mode,
      'pf_session_id', v_session.id
    ),
    'active'
  )
  RETURNING * INTO v_sess;

  INSERT INTO public.game_session_secrets (session_id, mines, crash_point_e6)
  VALUES (v_sess.id, NULL, v_crash_e6);

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

-- ─── crash_start_running_v1 — arm multiplier clock when betting ends ─────────

CREATE OR REPLACE FUNCTION public.crash_start_running_v1(p_round_id text)
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
  v_started bigint;
  v_existing bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'CRASH_SESSION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_existing := NULLIF((v_sess.client_state->>'started_at_ms')::bigint, 0);
  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('started_at_ms', v_existing, 'round_id', v_round);
  END IF;

  v_started := (extract(epoch from now()) * 1000)::bigint;

  UPDATE public.game_active_sessions
  SET
    client_state = v_sess.client_state || jsonb_build_object('started_at_ms', v_started),
    updated_at = now()
  WHERE id = v_sess.id;

  RETURN json_build_object('started_at_ms', v_started, 'round_id', v_round);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crash_start_running_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.crash_start_running_v1(text) FROM PUBLIC, anon;

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
    RAISE EXCEPTION 'CRASH_NOT_RUNNING';
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

-- ─── crash_sync_v1 — betting phase before clock armed ────────────────────────

CREATE OR REPLACE FUNCTION public.crash_sync_v1(p_round_id text)
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
  v_cur_e6 bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'idle');
  END IF;

  IF (v_sess.client_state->>'cashed_at_e6') IS NOT NULL THEN
    RETURN json_build_object('status', 'cashed');
  END IF;

  v_started := NULLIF((v_sess.client_state->>'started_at_ms')::bigint, 0);
  IF v_started IS NULL THEN
    RETURN json_build_object('status', 'betting');
  END IF;

  SELECT * INTO v_secret FROM public.game_session_secrets WHERE session_id = v_sess.id;
  v_crash_e6 := v_secret.crash_point_e6;
  v_elapsed := greatest(0, (extract(epoch from now()) * 1000)::bigint - v_started);
  v_cur_e6 := public.crash_multiplier_at_e6(v_elapsed);

  IF v_cur_e6 >= v_crash_e6 THEN
    UPDATE public.game_active_sessions
    SET status = 'settled', updated_at = now()
    WHERE id = v_sess.id;

    RETURN json_build_object(
      'status', 'busted',
      'crash_point_e6', v_crash_e6,
      'current_multiplier_e6', v_cur_e6
    );
  END IF;

  RETURN json_build_object(
    'status', 'running',
    'current_multiplier_e6', v_cur_e6
  );
END;
$$;

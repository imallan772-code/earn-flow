-- Hotfix: GA-M pf_degrade migration regressed limbo/wheel RPC response shapes.
-- Client Zod schemas expect crash_point/target (limbo) and multiplier/risk/segments (wheel).
-- Also broadens demo stale-session cleanup on mode switch (403 ACTIVE_GAME_SESSION).

-- ─── limbo_sync_v1 — tolerate legacy result_point in client_state ────────────

CREATE OR REPLACE FUNCTION public.limbo_sync_v1(p_round_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'limbo';
  v_round text := trim(p_round_id);
  v_sess public.game_active_sessions%ROWTYPE;
  v_cs jsonb;
  v_crash numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'idle');
  END IF;

  v_cs := v_sess.client_state;
  v_crash := COALESCE(
    NULLIF(v_cs->>'crash_point', '')::numeric,
    NULLIF(v_cs->>'result_point', '')::numeric
  );

  RETURN json_build_object(
    'status', 'pending_animation',
    'round_id', v_round,
    'mode', COALESCE(v_cs->>'bet_mode', 'real'),
    'nonce', (v_cs->>'nonce')::bigint,
    'next_nonce', (v_cs->>'next_nonce')::bigint,
    'crash_point', v_crash,
    'target', (v_cs->>'target')::numeric,
    'won', (v_cs->>'won')::boolean,
    'payout_multiplier', (v_cs->>'payout_multiplier')::numeric,
    'gross_payout', COALESCE((v_cs->>'gross_payout')::bigint, 0),
    'profit', COALESCE((v_cs->>'profit')::bigint, 0),
    'stake_amount', COALESCE((v_cs->>'stake_amount')::bigint, v_sess.bet_amount)
  );
END;
$$;

-- ─── limbo_place_v1 — restore GA-G response + kill_switch gate ───────────────

CREATE OR REPLACE FUNCTION public.limbo_place_v1(
  p_amount bigint,
  p_round_id text,
  p_target numeric,
  p_client_seed text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'limbo';
  v_round text := trim(p_round_id);
  v_mode text;
  v_pf json;
  v_session public.pf_sessions%ROWTYPE;
  v_used_nonce bigint;
  v_target numeric;
  v_crash numeric;
  v_mult numeric;
  v_won boolean;
  v_debit json := NULL;
  v_credit json := NULL;
  v_gross bigint := 0;
  v_profit bigint := 0;
  v_sess public.game_active_sessions%ROWTYPE;
  v_existing public.game_active_sessions%ROWTYPE;
  v_state jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  v_target := public.limbo_clamp_target(p_target);
  IF p_target IS NULL OR p_target < 1.01 OR p_target > 1000000 THEN
    RAISE EXCEPTION 'LIMBO_INVALID_TARGET';
  END IF;

  SELECT * INTO v_existing FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game;

  IF FOUND AND v_existing.status = 'active' THEN
    IF v_existing.round_id = v_round THEN
      RETURN public.limbo_sync_v1(v_round);
    END IF;
    RAISE EXCEPTION 'LIMBO_ACTIVE_SESSION' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_kill_switch_not_active();

  v_mode := public.resolve_user_mode_v1();

  IF v_mode = 'real' THEN
    PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  END IF;

  v_pf := public.pf_session_create_or_get_v1(v_game, p_client_seed);
  SELECT * INTO v_session FROM public.pf_sessions WHERE id = (v_pf->>'id')::uuid FOR UPDATE;
  v_used_nonce := v_session.nonce;

  v_crash := public.limbo_compute_point(v_session.server_seed, v_session.client_seed, v_used_nonce);
  v_mult := public.limbo_payout_multiplier(v_target);
  v_won := public.limbo_is_win(v_crash, v_target);

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
    'target', v_target,
    'crash_point', v_crash,
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
      v_uid, v_game, v_round,
      CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
      v_state, 'active'
    )
    RETURNING * INTO v_sess;
  END IF;

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'nonce', v_used_nonce,
    'next_nonce', v_used_nonce + 1,
    'crash_point', v_crash,
    'target', v_target,
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

-- ─── wheel_sync_v1 — tolerate missing multiplier in client_state ─────────────

CREATE OR REPLACE FUNCTION public.wheel_sync_v1(p_round_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'wheel';
  v_round text := trim(p_round_id);
  v_sess public.game_active_sessions%ROWTYPE;
  v_cs jsonb;
  v_mult numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'idle');
  END IF;

  v_cs := v_sess.client_state;
  v_mult := COALESCE(
    NULLIF(v_cs->>'multiplier', '')::numeric,
    NULLIF(v_cs->>'payout_multiplier', '')::numeric,
    0
  );

  RETURN json_build_object(
    'status', 'pending_animation',
    'round_id', v_round,
    'mode', COALESCE(v_cs->>'bet_mode', 'real'),
    'nonce', (v_cs->>'nonce')::bigint,
    'next_nonce', (v_cs->>'next_nonce')::bigint,
    'risk', v_cs->>'risk',
    'segments', (v_cs->>'segments')::int,
    'spin_index', (v_cs->>'spin_index')::int,
    'multiplier', v_mult,
    'won', (v_cs->>'won')::boolean,
    'payout_multiplier', (v_cs->>'payout_multiplier')::numeric,
    'gross_payout', COALESCE((v_cs->>'gross_payout')::bigint, 0),
    'profit', COALESCE((v_cs->>'profit')::bigint, 0),
    'stake_amount', COALESCE((v_cs->>'stake_amount')::bigint, v_sess.bet_amount)
  );
END;
$$;

-- ─── wheel_place_v1 — restore GA-H response + kill_switch gate ───────────────

CREATE OR REPLACE FUNCTION public.wheel_place_v1(
  p_amount bigint,
  p_round_id text,
  p_risk text DEFAULT 'medium',
  p_segments int DEFAULT 10,
  p_client_seed text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'wheel';
  v_round text := trim(p_round_id);
  v_mode text;
  v_pf json;
  v_session public.pf_sessions%ROWTYPE;
  v_used_nonce bigint;
  v_risk text := lower(trim(p_risk));
  v_segments int;
  v_index int;
  v_mult numeric;
  v_won boolean;
  v_debit json := NULL;
  v_credit json := NULL;
  v_gross bigint := 0;
  v_profit bigint := 0;
  v_sess public.game_active_sessions%ROWTYPE;
  v_existing public.game_active_sessions%ROWTYPE;
  v_state jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF v_risk NOT IN ('low', 'medium', 'high') THEN RAISE EXCEPTION 'WHEEL_INVALID_RISK'; END IF;
  IF p_segments NOT IN (10, 20, 30) THEN RAISE EXCEPTION 'WHEEL_INVALID_SEGMENTS'; END IF;
  v_segments := p_segments;

  SELECT * INTO v_existing FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game;

  IF FOUND AND v_existing.status = 'active' THEN
    IF v_existing.round_id = v_round THEN
      RETURN public.wheel_sync_v1(v_round);
    END IF;
    RAISE EXCEPTION 'WHEEL_ACTIVE_SESSION' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_kill_switch_not_active();

  v_mode := public.resolve_user_mode_v1();

  IF v_mode = 'real' THEN
    PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  END IF;

  v_pf := public.pf_session_create_or_get_v1(v_game, p_client_seed);
  SELECT * INTO v_session FROM public.pf_sessions WHERE id = (v_pf->>'id')::uuid FOR UPDATE;
  v_used_nonce := v_session.nonce;

  v_index := public.wheel_compute_spin_index(
    v_session.server_seed, v_session.client_seed, v_used_nonce, v_segments
  );
  v_mult := public.wheel_multiplier_at(v_risk, v_segments, v_index);
  v_won := public.wheel_is_win(v_mult);

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
    'risk', v_risk,
    'segments', v_segments,
    'spin_index', v_index,
    'multiplier', v_mult,
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
      v_uid, v_game, v_round,
      CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
      v_state, 'active'
    )
    RETURNING * INTO v_sess;
  END IF;

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'nonce', v_used_nonce,
    'next_nonce', v_used_nonce + 1,
    'risk', v_risk,
    'segments', v_segments,
    'spin_index', v_index,
    'multiplier', v_mult,
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

-- ─── user_set_preferred_mode_v1 — broader demo stale-session cleanup ─────────

CREATE OR REPLACE FUNCTION public.user_set_preferred_mode_v1(p_mode text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF p_mode NOT IN ('demo', 'real') THEN RAISE EXCEPTION 'INVALID_MODE'; END IF;

  IF public.auth_is_anonymous() AND p_mode = 'real' THEN
    RAISE EXCEPTION 'ANON_CANNOT_SET_REAL' USING ERRCODE = '42501';
  END IF;

  -- Demo instant-settle rounds with fixed outcomes (animation_pending) are safe to clear.
  UPDATE public.game_active_sessions
  SET
    status = 'settled',
    client_state = client_state || jsonb_build_object('animation_pending', false),
    updated_at = now()
  WHERE user_id = v_uid
    AND status = 'active'
    AND bet_amount = 0
    AND COALESCE(client_state->>'bet_mode', 'demo') = 'demo'
    AND COALESCE((client_state->>'animation_pending')::boolean, false) = true
    AND client_state ? 'won';

  -- Demo crash stuck in betting (never armed running clock) — safe to clear.
  UPDATE public.game_active_sessions
  SET status = 'settled', updated_at = now()
  WHERE user_id = v_uid
    AND status = 'active'
    AND game = 'crash'
    AND bet_amount = 0
    AND COALESCE(client_state->>'bet_mode', 'demo') = 'demo'
    AND NULLIF((client_state->>'started_at_ms')::bigint, 0) IS NULL;

  -- Demo plinko animation-only pending (already enqueued, no real stake).
  UPDATE public.game_active_sessions
  SET
    status = 'settled',
    client_state = client_state || jsonb_build_object('animation_pending', false),
    updated_at = now()
  WHERE user_id = v_uid
    AND status = 'active'
    AND game = 'plinko'
    AND bet_amount = 0
    AND COALESCE(client_state->>'bet_mode', 'demo') = 'demo'
    AND COALESCE((client_state->>'animation_pending')::boolean, false) = true;

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'ACTIVE_GAME_SESSION' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_settings (user_id, preferred_mode)
  VALUES (v_uid, p_mode)
  ON CONFLICT (user_id) DO UPDATE
    SET preferred_mode = EXCLUDED.preferred_mode,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.limbo_place_v1(bigint, text, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.limbo_place_v1(bigint, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limbo_sync_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.limbo_sync_v1(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wheel_place_v1(bigint, text, text, int, text) TO authenticated;
REVOKE ALL ON FUNCTION public.wheel_place_v1(bigint, text, text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wheel_sync_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.wheel_sync_v1(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_set_preferred_mode_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.user_set_preferred_mode_v1(text) FROM PUBLIC, anon;

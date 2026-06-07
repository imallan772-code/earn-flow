-- GA-H: Wheel server-authoritative instant settle (place = debit + credit atomic).
-- Template: GA-G Limbo. MULTIPLIERS table is server SSOT (matches WheelEngine.ts).
-- Does NOT touch live_bets triggers or autobot paths.

-- ─── Wheel multiplier tables (server SSOT — WheelEngine.ts parity) ───────────

CREATE OR REPLACE FUNCTION public.wheel_multipliers_10(p_risk text)
RETURNS numeric[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(p_risk))
    WHEN 'low' THEN ARRAY[1.5, 0, 1.2, 1.5, 1.2, 1.5, 1.2, 0, 1.5, 0.3]::numeric[]
    WHEN 'medium' THEN ARRAY[0, 0, 0, 1.8, 0, 3.0, 0, 1.8, 3.0, 0.3]::numeric[]
    WHEN 'high' THEN ARRAY[0, 0, 0, 0, 0, 0, 0, 0, 0, 9.9]::numeric[]
    ELSE ARRAY[]::numeric[]
  END;
$$;

REVOKE ALL ON FUNCTION public.wheel_multipliers_10(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wheel_get_multipliers(p_risk text, p_segments int)
RETURNS numeric[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base numeric[];
BEGIN
  v_base := public.wheel_multipliers_10(p_risk);
  IF array_length(v_base, 1) IS NULL OR array_length(v_base, 1) <> 10 THEN
    RETURN ARRAY[]::numeric[];
  END IF;
  IF p_segments = 10 THEN RETURN v_base; END IF;
  IF p_segments = 20 THEN RETURN v_base || v_base; END IF;
  IF p_segments = 30 THEN RETURN v_base || v_base || v_base; END IF;
  RETURN ARRAY[]::numeric[];
END;
$$;

REVOKE ALL ON FUNCTION public.wheel_get_multipliers(text, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wheel_compute_spin_index(
  p_server_seed text,
  p_client_seed text,
  p_nonce bigint,
  p_segments int
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_u double precision;
  v_idx int;
BEGIN
  v_u := public.pf_draw_float(p_server_seed, p_client_seed, p_nonce, 0);
  v_idx := floor(v_u * p_segments)::int;
  RETURN GREATEST(0, LEAST(p_segments - 1, v_idx));
END;
$$;

REVOKE ALL ON FUNCTION public.wheel_compute_spin_index(text, text, bigint, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wheel_multiplier_at(
  p_risk text,
  p_segments int,
  p_index int
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_arr numeric[];
  v_len int;
  v_safe int;
BEGIN
  v_arr := public.wheel_get_multipliers(p_risk, p_segments);
  v_len := COALESCE(array_length(v_arr, 1), 0);
  IF v_len = 0 THEN RETURN 0; END IF;
  v_safe := GREATEST(0, LEAST(v_len - 1, floor(p_index)::int));
  RETURN v_arr[v_safe + 1];
END;
$$;

REVOKE ALL ON FUNCTION public.wheel_multiplier_at(text, int, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wheel_is_win(p_multiplier numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_multiplier, 0) > 0;
$$;

REVOKE ALL ON FUNCTION public.wheel_is_win(numeric) FROM PUBLIC, anon, authenticated;

-- ─── wheel_place_v1 — atomic instant settle ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.wheel_place_v1(
  p_amount bigint,
  p_round_id text,
  p_risk text,
  p_segments int,
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

GRANT EXECUTE ON FUNCTION public.wheel_place_v1(bigint, text, text, int, text) TO authenticated;
REVOKE ALL ON FUNCTION public.wheel_place_v1(bigint, text, text, int, text) FROM PUBLIC, anon;

-- ─── wheel_sync_v1 — resume during rolling animation ─────────────────────────

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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'idle');
  END IF;

  v_cs := v_sess.client_state;

  RETURN json_build_object(
    'status', 'pending_animation',
    'round_id', v_round,
    'mode', COALESCE(v_cs->>'bet_mode', 'real'),
    'nonce', (v_cs->>'nonce')::bigint,
    'next_nonce', (v_cs->>'next_nonce')::bigint,
    'risk', v_cs->>'risk',
    'segments', (v_cs->>'segments')::int,
    'spin_index', (v_cs->>'spin_index')::int,
    'multiplier', (v_cs->>'multiplier')::numeric,
    'won', (v_cs->>'won')::boolean,
    'payout_multiplier', (v_cs->>'payout_multiplier')::numeric,
    'gross_payout', COALESCE((v_cs->>'gross_payout')::bigint, 0),
    'profit', COALESCE((v_cs->>'profit')::bigint, 0),
    'stake_amount', COALESCE((v_cs->>'stake_amount')::bigint, v_sess.bet_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wheel_sync_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.wheel_sync_v1(text) FROM PUBLIC, anon;

-- ─── wheel_complete_v1 — idempotent post-animation clear ─────────────────────

CREATE OR REPLACE FUNCTION public.wheel_complete_v1(p_round_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'wheel';
  v_round text := trim(p_round_id);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  UPDATE public.game_active_sessions
  SET
    status = 'settled',
    client_state = client_state || jsonb_build_object('animation_pending', false),
    updated_at = now()
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wheel_complete_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.wheel_complete_v1(text) FROM PUBLIC, anon;

-- ─── Feature flag ────────────────────────────────────────────────────────────

INSERT INTO public.game_authority_flags (key, enabled, rollout_percent, description)
VALUES ('wheel_server_settle', true, 100, 'GA-H Wheel server authority (verified → 100%)')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percent = EXCLUDED.rollout_percent,
  description = EXCLUDED.description,
  updated_at = now();

-- ─── RPC hardening (GA-H functions) ────────────────────────────────────────

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.wheel_multipliers_10(text)'::regprocedure,
    'public.wheel_get_multipliers(text,int)'::regprocedure,
    'public.wheel_compute_spin_index(text,text,bigint,int)'::regprocedure,
    'public.wheel_multiplier_at(text,int,int)'::regprocedure,
    'public.wheel_is_win(numeric)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.wheel_place_v1(bigint,text,text,int,text)'::regprocedure,
    'public.wheel_sync_v1(text)'::regprocedure,
    'public.wheel_complete_v1(text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

ALTER FUNCTION public.wheel_compute_spin_index(text, text, bigint, int) SET search_path = public, extensions;

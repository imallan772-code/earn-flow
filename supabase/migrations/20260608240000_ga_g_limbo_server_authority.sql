-- GA-G: Limbo server-authoritative instant settle (place = debit + credit atomic).
-- Template: GA-F Dice. Does NOT touch live_bets triggers or autobot paths.

-- ─── Limbo PF crash point (matches LimboEngine.ts computeCrashPoint) ─────────

CREATE OR REPLACE FUNCTION public.limbo_compute_point(
  p_server_seed text,
  p_client_seed text,
  p_nonce bigint
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_u double precision;
  v_denom double precision;
  v_raw double precision;
  v_crash numeric;
  v_min constant numeric := 1.0;
  v_max constant numeric := 1000000.0;
BEGIN
  v_u := public.pf_draw_float(p_server_seed, p_client_seed, p_nonce, 0);
  v_denom := GREATEST(1e-12, 1.0 - v_u);
  v_raw := (100.0 - v_u) / v_denom;
  v_crash := floor(v_raw) / 100.0;
  RETURN GREATEST(v_min, LEAST(v_max, v_crash));
END;
$$;

REVOKE ALL ON FUNCTION public.limbo_compute_point(text, text, bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.limbo_clamp_target(p_target numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1.01, LEAST(1000000.0, COALESCE(p_target, 1.01)));
$$;

REVOKE ALL ON FUNCTION public.limbo_clamp_target(numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.limbo_is_win(p_crash_point numeric, p_target numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_crash_point >= public.limbo_clamp_target(p_target);
$$;

REVOKE ALL ON FUNCTION public.limbo_is_win(numeric, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.limbo_payout_multiplier(p_target numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.limbo_clamp_target(p_target);
$$;

REVOKE ALL ON FUNCTION public.limbo_payout_multiplier(numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.limbo_win_chance_pct(p_target numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 99.0 / public.limbo_clamp_target(p_target);
$$;

REVOKE ALL ON FUNCTION public.limbo_win_chance_pct(numeric) FROM PUBLIC, anon, authenticated;

-- ─── limbo_place_v1 — atomic instant settle ──────────────────────────────────

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

GRANT EXECUTE ON FUNCTION public.limbo_place_v1(bigint, text, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.limbo_place_v1(bigint, text, numeric, text) FROM PUBLIC, anon;

-- ─── limbo_sync_v1 — resume during rolling animation ─────────────────────────

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
    'crash_point', (v_cs->>'crash_point')::numeric,
    'target', (v_cs->>'target')::numeric,
    'won', (v_cs->>'won')::boolean,
    'payout_multiplier', (v_cs->>'payout_multiplier')::numeric,
    'gross_payout', COALESCE((v_cs->>'gross_payout')::bigint, 0),
    'profit', COALESCE((v_cs->>'profit')::bigint, 0),
    'stake_amount', COALESCE((v_cs->>'stake_amount')::bigint, v_sess.bet_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.limbo_sync_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.limbo_sync_v1(text) FROM PUBLIC, anon;

-- ─── limbo_complete_v1 — idempotent post-animation clear ─────────────────────

CREATE OR REPLACE FUNCTION public.limbo_complete_v1(p_round_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'limbo';
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

GRANT EXECUTE ON FUNCTION public.limbo_complete_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.limbo_complete_v1(text) FROM PUBLIC, anon;

-- ─── Feature flag ────────────────────────────────────────────────────────────

INSERT INTO public.game_authority_flags (key, enabled, rollout_percent, description)
VALUES ('limbo_server_settle', true, 100, 'GA-G Limbo server authority (verified → 100%)')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percent = EXCLUDED.rollout_percent,
  description = EXCLUDED.description,
  updated_at = now();

-- ─── RPC hardening (GA-G functions) ────────────────────────────────────────

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.limbo_compute_point(text,text,bigint)'::regprocedure,
    'public.limbo_clamp_target(numeric)'::regprocedure,
    'public.limbo_is_win(numeric,numeric)'::regprocedure,
    'public.limbo_payout_multiplier(numeric)'::regprocedure,
    'public.limbo_win_chance_pct(numeric)'::regprocedure
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
    'public.limbo_place_v1(bigint,text,numeric,text)'::regprocedure,
    'public.limbo_sync_v1(text)'::regprocedure,
    'public.limbo_complete_v1(text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

ALTER FUNCTION public.limbo_compute_point(text, text, bigint) SET search_path = public, extensions;

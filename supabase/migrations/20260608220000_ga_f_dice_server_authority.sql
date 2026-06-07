-- GA-F: Dice server-authoritative instant settle (place = debit + credit atomic).
-- Template: GA-E Crash. Does NOT touch live_bets triggers or autobot paths.

-- ─── Dice PF roll (matches DiceEngine.ts computeRoll) ────────────────────────

CREATE OR REPLACE FUNCTION public.dice_compute_roll(
  p_server_seed text,
  p_client_seed text,
  p_nonce bigint
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_f double precision;
BEGIN
  v_f := public.pf_draw_float(p_server_seed, p_client_seed, p_nonce, 0);
  RETURN floor(v_f * 10000.0) / 100.0;
END;
$$;

REVOKE ALL ON FUNCTION public.dice_compute_roll(text, text, bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dice_win_chance_pct(p_target numeric, p_mode text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_t numeric;
  v_max constant numeric := 99.99;
BEGIN
  v_t := greatest(0.01, least(v_max - 0.01, p_target));
  IF lower(trim(p_mode)) = 'over' THEN
    RETURN ((v_max - v_t) / (v_max + 0.01)) * 100.0;
  END IF;
  RETURN ((v_t + 0.01) / (v_max + 0.01)) * 100.0;
END;
$$;

REVOKE ALL ON FUNCTION public.dice_win_chance_pct(numeric, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dice_payout_multiplier(p_chance_pct numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_chance_pct <= 0 THEN 0::numeric ELSE 99.0 / p_chance_pct END;
$$;

REVOKE ALL ON FUNCTION public.dice_payout_multiplier(numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dice_is_win(p_roll numeric, p_target numeric, p_mode text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(p_mode)) = 'over' THEN p_roll > p_target
    ELSE p_roll < p_target
  END;
$$;

REVOKE ALL ON FUNCTION public.dice_is_win(numeric, numeric, text) FROM PUBLIC, anon, authenticated;

-- ─── dice_place_v1 — atomic instant settle ───────────────────────────────────

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

GRANT EXECUTE ON FUNCTION public.dice_place_v1(bigint, text, numeric, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.dice_place_v1(bigint, text, numeric, text, text) FROM PUBLIC, anon;

-- ─── dice_sync_v1 — resume during rolling animation ───────────────────────────

CREATE OR REPLACE FUNCTION public.dice_sync_v1(p_round_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'dice';
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
    'roll', (v_cs->>'roll')::numeric,
    'won', (v_cs->>'won')::boolean,
    'target', (v_cs->>'target')::numeric,
    'dice_mode', v_cs->>'dice_mode',
    'payout_multiplier', (v_cs->>'payout_multiplier')::numeric,
    'gross_payout', COALESCE((v_cs->>'gross_payout')::bigint, 0),
    'profit', COALESCE((v_cs->>'profit')::bigint, 0),
    'stake_amount', COALESCE((v_cs->>'stake_amount')::bigint, v_sess.bet_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dice_sync_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.dice_sync_v1(text) FROM PUBLIC, anon;

-- ─── dice_complete_v1 — idempotent post-animation clear ──────────────────────

CREATE OR REPLACE FUNCTION public.dice_complete_v1(p_round_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'dice';
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

GRANT EXECUTE ON FUNCTION public.dice_complete_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.dice_complete_v1(text) FROM PUBLIC, anon;

-- ─── Feature flag ────────────────────────────────────────────────────────────

INSERT INTO public.game_authority_flags (key, enabled, rollout_percent, description)
VALUES ('dice_server_settle', true, 100, 'GA-F Dice server authority (verified → 100%)')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percent = EXCLUDED.rollout_percent,
  description = EXCLUDED.description,
  updated_at = now();

-- ─── RPC hardening (GA-F functions) ────────────────────────────────────────

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.dice_compute_roll(text,text,bigint)'::regprocedure,
    'public.dice_win_chance_pct(numeric,text)'::regprocedure,
    'public.dice_payout_multiplier(numeric)'::regprocedure,
    'public.dice_is_win(numeric,numeric,text)'::regprocedure
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
    'public.dice_place_v1(bigint,text,numeric,text,text)'::regprocedure,
    'public.dice_sync_v1(text)'::regprocedure,
    'public.dice_complete_v1(text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

ALTER FUNCTION public.dice_compute_roll(text, text, bigint) SET search_path = public, extensions;

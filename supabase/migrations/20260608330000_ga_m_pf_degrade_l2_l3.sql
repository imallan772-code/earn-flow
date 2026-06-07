-- GA-M: PF Degrade L2/L3 — kill_switch gate + health check + pf_degrade_audit.
-- Plan §4.1: L0 normal | L2 read-only resume | L3 full stop.
-- Does NOT touch live_bets triggers or autobot generation paths.

-- ─── pf_degrade_audit ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pf_degrade_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL CHECK (event IN ('L2_enter', 'L2_exit', 'L3_enter', 'L3_exit')),
  reason text NOT NULL,
  triggered_by text NOT NULL CHECK (triggered_by IN ('auto_health_check', 'manual_admin')),
  affected_user_count int,
  active_round_count int,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pf_degrade_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pf_degrade_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pf_degrade_audit TO authenticated;

DROP POLICY IF EXISTS pf_degrade_audit_admin_select ON public.pf_degrade_audit;
CREATE POLICY pf_degrade_audit_admin_select ON public.pf_degrade_audit
  FOR SELECT TO authenticated
  USING (public.assert_is_admin() = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pf_degrade_audit_created
  ON public.pf_degrade_audit (created_at DESC);

-- ─── Internal: log degrade event ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pf_degrade_log_v1(
  p_event text,
  p_reason text,
  p_triggered_by text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_rounds int;
  v_affected_users int;
BEGIN
  SELECT count(*)::int INTO v_active_rounds
  FROM public.game_active_sessions WHERE status = 'active';

  SELECT count(DISTINCT user_id)::int INTO v_affected_users
  FROM public.game_active_sessions WHERE status = 'active';

  INSERT INTO public.pf_degrade_audit
    (event, reason, triggered_by, affected_user_count, active_round_count, details)
  VALUES
    (p_event, p_reason, p_triggered_by, v_affected_users, v_active_rounds, p_details);
END;
$$;

REVOKE ALL ON FUNCTION public.pf_degrade_log_v1(text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ─── Kill-switch status (public read for client banner) ──────────────────────

CREATE OR REPLACE FUNCTION public.kill_switch_status_v1()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ks boolean;
  v_ro boolean;
BEGIN
  SELECT enabled INTO v_ks
  FROM public.game_authority_flags WHERE key = 'kill_switch';
  v_ks := COALESCE(v_ks, false);

  SELECT enabled INTO v_ro
  FROM public.game_authority_flags WHERE key = 'read_only_resume';
  v_ro := COALESCE(v_ro, true);

  RETURN json_build_object(
    'kill_switch', v_ks,
    'read_only_resume', v_ro,
    'level', CASE
      WHEN NOT v_ks THEN 'L0'
      WHEN v_ks AND v_ro THEN 'L2'
      ELSE 'L3'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kill_switch_status_v1() TO authenticated, anon;
REVOKE ALL ON FUNCTION public.kill_switch_status_v1() FROM PUBLIC;

-- ─── Admin: enter L2 (kill_switch + read_only_resume) ────────────────────────

CREATE OR REPLACE FUNCTION public.admin_enter_l2_v1(p_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
BEGIN
  PERFORM public.assert_is_admin();

  SELECT CASE WHEN enabled THEN 'L2' ELSE 'L0' END INTO v_prev
  FROM public.game_authority_flags WHERE key = 'kill_switch';

  IF v_prev = 'L2' THEN
    RETURN json_build_object('level', 'L2', 'message', 'already in L2 — no change');
  END IF;

  UPDATE public.game_authority_flags
  SET enabled = true, updated_at = now()
  WHERE key = 'kill_switch';

  UPDATE public.game_authority_flags
  SET enabled = true, updated_at = now()
  WHERE key = 'read_only_resume';

  PERFORM public.pf_degrade_log_v1('L2_enter', p_reason, 'manual_admin');

  RETURN public.kill_switch_status_v1();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_enter_l2_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_enter_l2_v1(text) FROM PUBLIC, anon;

-- ─── Admin: enter L3 (kill_switch + NOT read_only_resume) ────────────────────

CREATE OR REPLACE FUNCTION public.admin_enter_l3_v1(p_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_is_admin();

  UPDATE public.game_authority_flags
  SET enabled = true, updated_at = now()
  WHERE key = 'kill_switch';

  UPDATE public.game_authority_flags
  SET enabled = false, updated_at = now()
  WHERE key = 'read_only_resume';

  PERFORM public.pf_degrade_log_v1('L3_enter', p_reason, 'manual_admin');

  RETURN public.kill_switch_status_v1();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_enter_l3_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_enter_l3_v1(text) FROM PUBLIC, anon;

-- ─── Admin: exit L2/L3 → L0 ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_exit_degrade_v1(p_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_level text;
BEGIN
  PERFORM public.assert_is_admin();

  SELECT CASE
    WHEN NOT enabled THEN 'L0'
    ELSE 'L2_or_L3'
  END INTO v_prev_level
  FROM public.game_authority_flags WHERE key = 'kill_switch';

  UPDATE public.game_authority_flags
  SET enabled = false, updated_at = now()
  WHERE key = 'kill_switch';

  UPDATE public.game_authority_flags
  SET enabled = true, updated_at = now()
  WHERE key = 'read_only_resume';

  IF v_prev_level <> 'L0' THEN
    PERFORM public.pf_degrade_log_v1('L2_exit', p_reason, 'manual_admin');
  END IF;

  RETURN public.kill_switch_status_v1();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_exit_degrade_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_exit_degrade_v1(text) FROM PUBLIC, anon;

-- ─── Auto-health: enter L2 when PF session error rate > threshold ─────────────

CREATE OR REPLACE FUNCTION public.pf_health_check_v1()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ks boolean;
  v_recent_rounds int;
  v_failed_pf int;
  v_error_rate numeric;
  v_threshold numeric := 0.05;  -- 5%
BEGIN
  SELECT enabled INTO v_ks
  FROM public.game_authority_flags WHERE key = 'kill_switch';
  IF COALESCE(v_ks, false) THEN
    RETURN json_build_object('action', 'skipped', 'reason', 'already in degrade');
  END IF;

  SELECT count(*)::int INTO v_recent_rounds
  FROM public.game_active_sessions
  WHERE created_at > now() - interval '5 minutes';

  IF v_recent_rounds = 0 THEN
    RETURN json_build_object('action', 'ok', 'rounds_checked', 0, 'error_rate', 0);
  END IF;

  SELECT count(*)::int INTO v_failed_pf
  FROM public.game_active_sessions gs
  WHERE gs.created_at > now() - interval '5 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.pf_sessions pf
      WHERE pf.user_id = gs.user_id
        AND pf.game = gs.game
        AND pf.status = 'active'
    );

  v_error_rate := v_failed_pf::numeric / GREATEST(v_recent_rounds, 1);

  IF v_error_rate > v_threshold THEN
    UPDATE public.game_authority_flags
    SET enabled = true, updated_at = now()
    WHERE key = 'kill_switch';

    UPDATE public.game_authority_flags
    SET enabled = true, updated_at = now()
    WHERE key = 'read_only_resume';

    PERFORM public.pf_degrade_log_v1(
      'L2_enter',
      format('auto: pf_error_rate=%.2f%% > threshold=%.2f%% (rounds=%s failed=%s)',
        v_error_rate * 100, v_threshold * 100, v_recent_rounds, v_failed_pf),
      'auto_health_check',
      jsonb_build_object('error_rate', v_error_rate, 'rounds', v_recent_rounds, 'failed', v_failed_pf)
    );

    RETURN json_build_object(
      'action', 'L2_entered',
      'error_rate', v_error_rate,
      'rounds_checked', v_recent_rounds,
      'failed_pf', v_failed_pf
    );
  END IF;

  RETURN json_build_object(
    'action', 'ok',
    'error_rate', v_error_rate,
    'rounds_checked', v_recent_rounds,
    'failed_pf', v_failed_pf
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pf_health_check_v1() FROM PUBLIC, anon, authenticated;

-- ─── Helper: check if new bet is allowed given current degrade state ──────────

CREATE OR REPLACE FUNCTION public.assert_kill_switch_not_active()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.game_authority_flags
    WHERE key = 'kill_switch' AND enabled
  ) THEN
    RAISE EXCEPTION 'KILL_SWITCH_ACTIVE'
      USING ERRCODE = '42501',
            HINT = 'System is in maintenance mode. New bets are not allowed. Active rounds can still be resumed.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_kill_switch_not_active() FROM PUBLIC, anon, authenticated;

-- ─── Patch game place RPCs with kill_switch gate ─────────────────────────────
-- crash_place_v1 (latest version from crash_place_recycle_settled)

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

  -- L2/L3: block new bets
  PERFORM public.assert_kill_switch_not_active();

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
      v_uid, v_game, v_round,
      CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
      v_state, 'active'
    )
    RETURNING * INTO v_sess;

    INSERT INTO public.game_session_secrets (session_id, mines, crash_point_e6)
    VALUES (v_sess.id, NULL, v_crash_e6);
  END IF;

  UPDATE public.pf_sessions SET nonce = nonce + 1 WHERE id = v_session.id;

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'nonce', v_session.nonce,
    'server_seed_hash', v_session.server_seed_hash,
    'debit', v_debit,
    'session_id', v_sess.id
  );
END;
$$;

-- ─── dice_place_v1 kill_switch gate ──────────────────────────────────────────

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

  -- L2/L3: block new bets
  PERFORM public.assert_kill_switch_not_active();

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

-- ─── limbo_place_v1 kill_switch gate ─────────────────────────────────────────

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
  v_mult := public.limbo_payout_multiplier(p_target);
  v_won := public.limbo_is_win(v_crash, p_target);

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
    'result_point', v_crash,
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
    SET round_id = v_round,
        bet_amount = CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
        client_state = v_state, status = 'active', updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_sess;
  ELSE
    INSERT INTO public.game_active_sessions (user_id, game, round_id, bet_amount, client_state, status)
    VALUES (v_uid, v_game, v_round,
            CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END, v_state, 'active')
    RETURNING * INTO v_sess;
  END IF;

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'nonce', v_used_nonce,
    'next_nonce', v_used_nonce + 1,
    'result_point', v_crash,
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

-- ─── wheel_place_v1 kill_switch gate ─────────────────────────────────────────

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
  v_risk text := lower(trim(p_risk));
  v_segments int := GREATEST(10, LEAST(50, p_segments));
  v_mode text;
  v_pf json;
  v_session public.pf_sessions%ROWTYPE;
  v_used_nonce bigint;
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

  v_index := public.wheel_compute_spin_index(v_session.server_seed, v_session.client_seed, v_used_nonce, v_segments);
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
    SET round_id = v_round,
        bet_amount = CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
        client_state = v_state, status = 'active', updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_sess;
  ELSE
    INSERT INTO public.game_active_sessions (user_id, game, round_id, bet_amount, client_state, status)
    VALUES (v_uid, v_game, v_round,
            CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END, v_state, 'active')
    RETURNING * INTO v_sess;
  END IF;

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'nonce', v_used_nonce,
    'next_nonce', v_used_nonce + 1,
    'spin_index', v_index,
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

-- ─── plinko_enqueue_v1 kill_switch gate ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.plinko_enqueue_v1(
  p_amount bigint,
  p_round_id text,
  p_rows int DEFAULT 16,
  p_risk text DEFAULT 'medium',
  p_client_seed text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'plinko';
  v_round text := trim(p_round_id);
  v_rows int := GREATEST(8, LEAST(16, p_rows));
  v_risk text := lower(trim(p_risk));
  v_mode text;
  v_pf json;
  v_session public.pf_sessions%ROWTYPE;
  v_used_nonce bigint;
  v_path_json json;
  v_path int[];
  v_final int;
  v_mult numeric;
  v_gross bigint := 0;
  v_debit json := NULL;
  v_q public.plinko_queue%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF v_risk NOT IN ('low', 'medium', 'high') THEN RAISE EXCEPTION 'PLINKO_INVALID_RISK'; END IF;

  PERFORM public.assert_kill_switch_not_active();

  v_mode := public.resolve_user_mode_v1();

  IF v_mode = 'real' THEN
    PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);
  END IF;

  v_pf := public.pf_session_create_or_get_v1(v_game, p_client_seed);
  SELECT * INTO v_session FROM public.pf_sessions WHERE id = (v_pf->>'id')::uuid FOR UPDATE;
  v_used_nonce := v_session.nonce;

  v_path_json := public.plinko_compute_path(v_session.server_seed, v_session.client_seed, v_used_nonce, v_rows);
  SELECT COALESCE(array_agg(elem::int ORDER BY ord), ARRAY[]::int[])
  INTO v_path
  FROM json_array_elements_text(v_path_json->'path') WITH ORDINALITY AS t(elem, ord);
  v_final := (v_path_json->>'final_slot')::int;
  v_mult := public.plinko_multiplier_at(v_risk, v_rows, v_final);

  IF v_mode = 'real' THEN
    v_debit := public.debit_phon_for_bet_v2(p_amount, v_game, v_round);
  END IF;

  v_gross := public.compute_payout_phon(CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END, v_mult);

  UPDATE public.pf_sessions SET nonce = nonce + 1 WHERE id = v_session.id;

  INSERT INTO public.plinko_queue (
    user_id, round_id, bet_amount, rows, risk, path, final_slot, multiplier,
    gross_payout, mode, pf_nonce, pf_session_id, status
  ) VALUES (
    v_uid, v_round,
    CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
    v_rows, v_risk, v_path, v_final, v_mult,
    v_gross, v_mode, v_used_nonce, v_session.id, 'pending'
  )
  RETURNING * INTO v_q;

  RETURN json_build_object(
    'queue_id', v_q.id,
    'round_id', v_round,
    'mode', v_mode,
    'nonce', v_used_nonce,
    'server_seed_hash', v_session.server_seed_hash,
    'path', v_path,
    'final_slot', v_final,
    'multiplier', v_mult,
    'debit', v_debit
  );
END;
$$;

-- ─── mines_start_round_v1 kill_switch gate (latest idempotent version) ────────

CREATE OR REPLACE FUNCTION public.mines_start_round_v1(
  p_amount bigint,
  p_round_id text,
  p_mine_count int,
  p_client_seed text,
  p_nonce bigint,
  p_server_seed text DEFAULT 'phonara-mines-demo-server-seed-v1'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'mines';
  v_round text := trim(p_round_id);
  v_mode text := public.resolve_user_mode_v1();
  v_debit json;
  v_mines int[];
  v_state jsonb;
  v_session public.game_active_sessions%ROWTYPE;
  v_existing public.game_active_sessions%ROWTYPE;
  v_revealed jsonb;
  v_mine_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);

  SELECT * INTO v_existing FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND status = 'active';

  IF FOUND THEN
    IF v_existing.round_id = v_round THEN
      v_revealed := COALESCE(v_existing.client_state->'revealed', '[]'::jsonb);
      v_mine_count := COALESCE(
        (v_existing.client_state->>'mine_count')::int,
        public.mines_clamp_count(p_mine_count)
      );
      RETURN json_build_object(
        'debit', NULL,
        'session_id', v_existing.id,
        'round_id', v_existing.round_id,
        'bet_amount', v_existing.bet_amount,
        'mine_count', v_mine_count,
        'nonce', COALESCE((v_existing.client_state->>'nonce')::bigint, p_nonce),
        'idempotent', true
      );
    END IF;
    RAISE EXCEPTION 'MINES_SESSION_ACTIVE' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.assert_kill_switch_not_active();

  v_debit := public.debit_phon_for_bet_v2(p_amount, v_game, v_round);
  v_mines := public.mines_generate_layout(p_server_seed, p_client_seed, p_nonce, p_mine_count);

  v_state := jsonb_build_object(
    'nonce', p_nonce,
    'mine_count', public.mines_clamp_count(p_mine_count),
    'client_seed', trim(p_client_seed),
    'server_seed', p_server_seed,
    'revealed', '[]'::jsonb,
    'bet_mode', v_mode
  );

  SELECT * INTO v_existing FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game;

  IF FOUND THEN
    UPDATE public.game_active_sessions
    SET
      round_id = v_round,
      bet_amount = CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
      client_state = v_state,
      status = 'active',
      updated_at = now()
    WHERE user_id = v_uid AND game = v_game
    RETURNING * INTO v_session;
    DELETE FROM public.game_session_secrets WHERE session_id = v_session.id;
  ELSE
    INSERT INTO public.game_active_sessions (user_id, game, round_id, bet_amount, client_state, status)
    VALUES (v_uid, v_game, v_round,
            CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END, v_state, 'active')
    RETURNING * INTO v_session;
  END IF;

  INSERT INTO public.game_session_secrets (session_id, mines, crash_point_e6)
  VALUES (v_session.id, v_mines, NULL);

  RETURN json_build_object(
    'debit', v_debit,
    'session_id', v_session.id,
    'round_id', v_round,
    'bet_amount', p_amount,
    'mine_count', public.mines_clamp_count(p_mine_count),
    'nonce', p_nonce,
    'idempotent', false
  );
END;
$$;

-- ─── Grants for patched RPCs ─────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.kill_switch_status_v1() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_enter_l2_v1(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_enter_l3_v1(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exit_degrade_v1(text) TO authenticated;

DO $$
DECLARE fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_enter_l2_v1(text)'::regprocedure,
    'public.admin_enter_l3_v1(text)'::regprocedure,
    'public.admin_exit_degrade_v1(text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

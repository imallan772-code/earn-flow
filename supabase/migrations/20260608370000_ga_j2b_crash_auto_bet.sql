-- GA-J2b: Crash auto-bet server authority.
-- Adds game_phase/current_round_id/phase_started_at columns for worker state machine.
-- Creates auto_bet_crash_settle_internal for instant auto-cashout (bypasses real-time elapsed check).
-- Extends auto_bet_create_v1 for 'crash' and auto_bet_execute_round_v1 with crash flow.

-- ─── Worker state machine columns ───────────────────────────────────────────

ALTER TABLE public.auto_bet_sessions
  ADD COLUMN IF NOT EXISTS game_phase text NOT NULL DEFAULT 'idle'
    CHECK (game_phase IN ('idle','placed','running','settling','mines_revealing','mines_cashout_pending'));

ALTER TABLE public.auto_bet_sessions
  ADD COLUMN IF NOT EXISTS current_round_id text;

ALTER TABLE public.auto_bet_sessions
  ADD COLUMN IF NOT EXISTS phase_started_at timestamptz;

-- ─── auto_bet_crash_settle_internal ─────────────────────────────────────────
-- Settles a crash session immediately based on crash_point vs auto_target.
-- For auto-bet only (bypasses real-time elapsed restriction).

CREATE OR REPLACE FUNCTION public.auto_bet_crash_settle_internal(
  p_round_id text,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game text := 'crash';
  v_sess public.game_active_sessions%ROWTYPE;
  v_secret public.game_session_secrets%ROWTYPE;
  v_crash_e6 bigint;
  v_auto_target_e6 bigint;
  v_mode text;
  v_bet bigint;
  v_gross bigint := 0;
  v_profit bigint := 0;
  v_credit json := NULL;
  v_won boolean := false;
  v_cashed_at_e6 bigint := NULL;
BEGIN
  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = p_user_id AND game = v_game AND round_id = p_round_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_secret FROM public.game_session_secrets WHERE session_id = v_sess.id;
  v_crash_e6 := v_secret.crash_point_e6;
  IF v_crash_e6 IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'crash_secret_missing');
  END IF;

  v_auto_target_e6 := COALESCE((v_sess.client_state->>'auto_target_e6')::bigint, 0);
  v_mode := COALESCE(v_sess.client_state->>'bet_mode', 'demo');
  v_bet := v_sess.bet_amount;

  IF v_auto_target_e6 > 1000000 AND v_auto_target_e6 <= v_crash_e6 THEN
    v_won := true;
    v_cashed_at_e6 := v_auto_target_e6;
    IF v_mode = 'real' AND v_bet > 0 THEN
      v_gross := round(v_bet::numeric * (v_auto_target_e6 / 1000000.0))::bigint;
      v_profit := v_gross - v_bet;
      IF v_gross >= 1 THEN
        PERFORM public.auto_bet_internal_set_uid(p_user_id);
        v_credit := public.credit_phon_for_payout_v2(v_gross, v_game, p_round_id);
      END IF;
    ELSE
      v_gross := round(v_bet::numeric * (v_auto_target_e6 / 1000000.0))::bigint;
      v_profit := v_gross - v_bet;
    END IF;
  ELSE
    v_won := false;
    v_profit := -v_bet;
  END IF;

  UPDATE public.game_active_sessions
  SET
    status = 'settled',
    client_state = v_sess.client_state || jsonb_build_object('cashed_at_e6', v_cashed_at_e6),
    updated_at = now()
  WHERE id = v_sess.id;

  UPDATE public.pf_sessions
  SET nonce = nonce + 1
  WHERE id = (v_sess.client_state->>'pf_session_id')::uuid;

  RETURN json_build_object(
    'round_id', p_round_id,
    'won', v_won,
    'crash_point_e6', v_crash_e6,
    'cashed_at_e6', v_cashed_at_e6,
    'profit', v_profit,
    'gross_payout', COALESCE(v_gross, 0),
    'credit', v_credit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_bet_crash_settle_internal(text, uuid) FROM PUBLIC, anon, authenticated;

-- ─── Update auto_bet_create_v1: allow crash ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_bet_create_v1(
  p_game text,
  p_config jsonb,
  p_bet_params jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := lower(trim(p_game));
  v_settings public.user_settings%ROWTYPE;
  v_active int;
  v_base_bet bigint;
  v_bankroll bigint := 0;
  v_row public.auto_bet_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  IF EXISTS (SELECT 1 FROM public.game_authority_flags WHERE key = 'kill_switch' AND enabled) THEN
    RAISE EXCEPTION 'KILL_SWITCH_ACTIVE';
  END IF;

  IF NOT public.game_authority_flag_v1('auto_bet_server') THEN
    RAISE EXCEPTION 'AUTO_BET_SERVER_DISABLED';
  END IF;

  IF v_game NOT IN ('dice', 'limbo', 'wheel', 'plinko', 'crash') THEN
    RAISE EXCEPTION 'AUTO_BET_GAME_UNSUPPORTED' USING ERRCODE = '22000';
  END IF;

  v_settings := public.ensure_user_settings_v1(v_uid);
  IF v_settings.auto_bet_consent_at IS NULL THEN
    RAISE EXCEPTION 'AUTO_BET_CONSENT_REQUIRED';
  END IF;

  SELECT count(*)::int INTO v_active
  FROM public.auto_bet_sessions
  WHERE user_id = v_uid AND status IN ('running', 'paused', 'stopping');
  IF v_active >= 3 THEN
    RAISE EXCEPTION 'AUTO_BET_MAX_SESSIONS' USING ERRCODE = '22000';
  END IF;

  v_base_bet := greatest(1, coalesce((p_config->>'baseBet')::bigint, (p_config->>'base_bet')::bigint, 1));

  SELECT coalesce(phon, 0) INTO v_bankroll
  FROM public.wallet_balances WHERE user_id = v_uid;

  INSERT INTO public.auto_bet_sessions (
    user_id, game, status, config, bet_params, current_bet, starting_bankroll_phon, next_tick_at
  ) VALUES (
    v_uid, v_game, 'running', p_config, coalesce(p_bet_params, '{}'::jsonb),
    v_base_bet, v_bankroll, now()
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'game', v_row.game,
    'status', v_row.status,
    'config', v_row.config,
    'bet_params', v_row.bet_params,
    'current_bet', v_row.current_bet,
    'bets_placed', v_row.bets_placed,
    'pnl', v_row.pnl,
    'fib_index', v_row.fib_index,
    'stop_reason', v_row.stop_reason,
    'next_tick_at', v_row.next_tick_at,
    'created_at', v_row.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_bet_create_v1(text, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.auto_bet_create_v1(text, jsonb, jsonb) FROM PUBLIC, anon;

-- ─── Update auto_bet_execute_round_v1: add crash place+settle ───────────────

CREATE OR REPLACE FUNCTION public.auto_bet_execute_round_v1(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auto_bet_sessions%ROWTYPE;
  v_settings public.user_settings%ROWTYPE;
  v_round_id text;
  v_place json;
  v_outcome text;
  v_delta bigint := 0;
  v_step jsonb;
  v_running boolean;
  v_balance bigint;
  v_today date := (timezone('utc', now()))::date;
  v_daily_rounds int;
  v_plinko_complete json;
  v_crash_settle json;
BEGIN
  SELECT * INTO v_row FROM public.auto_bet_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_row.status <> 'running' THEN
    RETURN json_build_object('skipped', true, 'reason', 'not_running');
  END IF;

  v_settings := public.ensure_user_settings_v1(v_row.user_id);

  IF v_row.daily_rounds_date <> v_today THEN
    v_daily_rounds := 0;
  ELSE
    v_daily_rounds := v_row.daily_rounds_today;
  END IF;

  IF v_daily_rounds >= v_settings.daily_round_limit THEN
    UPDATE public.auto_bet_sessions
    SET status = 'stopped', stop_reason = 'limit', stopped_at = now(), updated_at = now(),
        last_error = 'daily_round_limit'
    WHERE id = v_row.id;
    RETURN json_build_object('stopped', true, 'reason', 'daily_round_limit');
  END IF;

  IF v_settings.daily_loss_limit_phon IS NOT NULL AND v_row.pnl <= -v_settings.daily_loss_limit_phon THEN
    UPDATE public.auto_bet_sessions
    SET status = 'stopped', stop_reason = 'limit', stopped_at = now(), updated_at = now(),
        last_error = 'daily_loss_limit_phon'
    WHERE id = v_row.id;
    RETURN json_build_object('stopped', true, 'reason', 'daily_loss_limit_phon');
  END IF;

  IF v_settings.daily_loss_limit_pct IS NOT NULL AND v_row.starting_bankroll_phon > 0 THEN
    IF v_row.pnl <= -round(v_row.starting_bankroll_phon::numeric * v_settings.daily_loss_limit_pct / 100.0)::bigint THEN
      UPDATE public.auto_bet_sessions
      SET status = 'stopped', stop_reason = 'limit', stopped_at = now(), updated_at = now(),
          last_error = 'daily_loss_limit_pct'
      WHERE id = v_row.id;
      RETURN json_build_object('stopped', true, 'reason', 'daily_loss_limit_pct');
    END IF;
  END IF;

  IF v_settings.max_consecutive_losses IS NOT NULL AND v_row.consecutive_losses >= v_settings.max_consecutive_losses THEN
    UPDATE public.auto_bet_sessions
    SET status = 'stopped', stop_reason = 'limit', stopped_at = now(), updated_at = now(),
        last_error = 'max_consecutive_losses'
    WHERE id = v_row.id;
    RETURN json_build_object('stopped', true, 'reason', 'max_consecutive_losses');
  END IF;

  PERFORM public.auto_bet_internal_set_uid(v_row.user_id);

  SELECT coalesce(phon, 0) INTO v_balance FROM public.wallet_balances WHERE user_id = v_row.user_id;
  IF v_balance < v_row.current_bet AND public.resolve_user_mode_v1() = 'real' THEN
    UPDATE public.auto_bet_sessions
    SET status = 'stopped', stop_reason = 'error', stopped_at = now(), updated_at = now(),
        last_error = 'insufficient_funds'
    WHERE id = v_row.id;
    RETURN json_build_object('stopped', true, 'reason', 'insufficient_funds');
  END IF;

  v_round_id := 'autobet-' || replace(v_row.id::text, '-', '') || '-n' || (v_row.bets_placed + 1)::text;

  BEGIN
    CASE v_row.game
      WHEN 'dice' THEN
        v_place := public.dice_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'target')::numeric, 50),
          coalesce(v_row.bet_params->>'dice_mode', 'over'),
          NULL
        );
      WHEN 'limbo' THEN
        v_place := public.limbo_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'target')::numeric, 2.0),
          NULL
        );
      WHEN 'wheel' THEN
        v_place := public.wheel_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce(v_row.bet_params->>'risk', 'medium'),
          coalesce((v_row.bet_params->>'segments')::int, 10),
          NULL
        );
      WHEN 'plinko' THEN
        v_place := public.plinko_enqueue_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'rows')::int, 12),
          coalesce(v_row.bet_params->>'risk', 'medium'),
          NULL
        );
        v_plinko_complete := public.plinko_complete_v1(v_round_id);
        v_place := json_build_object(
          'profit', coalesce((v_plinko_complete->>'profit')::bigint, (v_place->>'profit')::bigint, 0),
          'won', coalesce((v_plinko_complete->>'won')::boolean, false),
          'multiplier', coalesce(v_plinko_complete->>'multiplier', v_place->>'multiplier'),
          'round_id', v_round_id
        );
      WHEN 'crash' THEN
        UPDATE public.auto_bet_sessions
        SET game_phase = 'placed', current_round_id = v_round_id, phase_started_at = now()
        WHERE id = v_row.id;

        v_place := public.crash_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'auto_target_e6')::bigint, 2000000),
          NULL
        );

        v_crash_settle := public.auto_bet_crash_settle_internal(v_round_id, v_row.user_id);

        UPDATE public.auto_bet_sessions
        SET game_phase = 'idle', current_round_id = NULL, phase_started_at = NULL
        WHERE id = v_row.id;

        v_place := json_build_object(
          'profit', coalesce((v_crash_settle->>'profit')::bigint, 0),
          'won', coalesce((v_crash_settle->>'won')::boolean, false),
          'crash_point_e6', (v_crash_settle->>'crash_point_e6')::bigint,
          'round_id', v_round_id
        );
      ELSE
        RAISE EXCEPTION 'AUTO_BET_GAME_UNSUPPORTED';
    END CASE;
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.auto_bet_sessions
      SET status = 'stopped', stop_reason = 'error', stopped_at = now(), updated_at = now(),
          last_error = left(SQLERRM, 200),
          game_phase = 'idle', current_round_id = NULL, phase_started_at = NULL
      WHERE id = v_row.id;
      RETURN json_build_object('stopped', true, 'reason', 'place_error', 'error', SQLERRM);
  END;

  v_delta := coalesce((v_place->>'profit')::bigint, 0);
  IF v_delta > 0 THEN
    v_outcome := 'win';
  ELSIF v_delta < 0 THEN
    v_outcome := 'loss';
  ELSIF coalesce((v_place->>'won')::boolean, false) THEN
    v_outcome := 'win';
  ELSE
    v_outcome := 'loss';
  END IF;

  v_step := public.auto_bet_apply_outcome_v1(
    v_row.config, v_row.current_bet, v_row.fib_index, v_row.bets_placed, v_row.pnl,
    v_outcome, v_delta
  );
  v_running := coalesce((v_step->>'running')::boolean, false);

  UPDATE public.auto_bet_sessions
  SET
    current_bet = (v_step->>'current_bet')::bigint,
    bets_placed = (v_step->>'bets_placed')::int,
    pnl = (v_step->>'pnl')::bigint,
    fib_index = (v_step->>'fib_index')::int,
    consecutive_losses = CASE WHEN v_outcome = 'loss' THEN consecutive_losses + 1 ELSE 0 END,
    daily_rounds_today = CASE WHEN daily_rounds_date = v_today THEN daily_rounds_today + 1 ELSE 1 END,
    daily_rounds_date = v_today,
    status = CASE
      WHEN NOT v_running THEN 'completed'
      ELSE 'running'
    END,
    stop_reason = CASE WHEN NOT v_running THEN coalesce(v_step->>'stop_reason', 'count') ELSE stop_reason END,
    stopped_at = CASE WHEN NOT v_running THEN now() ELSE stopped_at END,
    last_tick_at = now(),
    next_tick_at = now() + interval '1 second',
    updated_at = now(),
    last_error = NULL
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'session_id', v_row.id,
    'placed', true,
    'outcome', v_outcome,
    'delta', v_delta,
    'status', v_row.status,
    'bets_placed', v_row.bets_placed,
    'pnl', v_row.pnl,
    'current_bet', v_row.current_bet
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_bet_execute_round_v1(uuid) FROM PUBLIC, anon, authenticated;
